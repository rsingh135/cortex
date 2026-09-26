/**
 * Maya's listings. Every scripted hunt is built from contrastive pairs so the learner cannot
 * mistake which attribute caused a rejection, plus traps for the agent's live hunt.
 */
import { walkupFloor, type Listing } from "@cortex/schema";
import type { Rng } from "./prng";

export const TRUE_BUDGET = 2800;

/** Neighborhoods and the train that serves them in this fictional New York. */
export const NEIGHBORHOODS: Record<string, string> = {
  Bushwick: "L",
  Williamsburg: "L",
  "East Williamsburg": "L",
  Ridgewood: "L",
  Greenpoint: "G",
  Astoria: "N",
  "Park Slope": "F",
  "Crown Heights": "3",
  "Bed-Stuy": "A",
};
const ON_L = Object.keys(NEIGHBORHOODS).filter((n) => NEIGHBORHOODS[n] === "L");
const OFF_L = Object.keys(NEIGHBORHOODS).filter((n) => NEIGHBORHOODS[n] !== "L");

const LANDLORDS = ["Dana Whitfield", "Marcus Oyelaran", "Priyanka Rao", "Tom Kessler", "Lena Moreau", "Sofia Alvarez", "Jordan Blake", "Nina Petrova", "Omar Haddad", "Grace Lin"];
const CABINETS = ["sage green", "navy blue", "white oak", "matte black", "butter yellow", "walnut", "terracotta", "pale grey"];
const STREETS = ["Wyckoff Ave", "Knickerbocker Ave", "Grand St", "Bedford Ave", "Metropolitan Ave", "Seneca Ave", "Manhattan Ave", "Irving Ave", "Graham Ave", "Myrtle Ave"];

type Raw = Omit<Listing, "_id" | "hunt" | "title" | "description" | "walkup_floor" | "photos" | "landlord"> & Partial<Pick<Listing, "trap" | "pair_with">>;

interface Spec {
  id: number;
  hunt: Listing["hunt"];
  raw: Raw;
  /** Extra seen-once details baked into the description. */
  unit: string;
  cabinets: string;
  street: string;
  available: string;
  bed: string;
  adjective: string;
}

function base(rng: Rng, overrides: Partial<Raw> = {}): Raw {
  const neighborhood = overrides.neighborhood ?? rng.pick(ON_L);
  const floor = overrides.floor ?? rng.int(1, 3);
  return {
    price: rng.int(22, 27) * 100 + rng.pick([0, 25, 50, 75]),
    neighborhood,
    train: NEIGHBORHOODS[neighborhood]!,
    floor,
    elevator: false,
    laundry: true,
    pets: rng.chance(0.5),
    ...overrides,
  };
}

function finish(rng: Rng, spec: Spec): Listing {
  const { raw, bed, adjective } = spec;
  const title = `${adjective} ${bed} in ${raw.neighborhood}`;
  const description = [
    `${bed} on the ${ordinal(raw.floor)} floor of a ${raw.elevator ? "elevator building" : "walk-up"} at ${spec.street}, unit ${spec.unit}.`,
    `${raw.laundry ? "Laundry in the building." : "No laundry on site; laundromat two blocks away."}`,
    `Kitchen with ${spec.cabinets} cabinets.`,
    `${raw.pets ? "Pets welcome." : "Sorry, no pets."}`,
    `Nearest train: ${raw.train}. Available ${spec.available}.`,
  ].join(" ");
  const listing: Listing = {
    _id: `listing:${spec.id}`,
    hunt: spec.hunt,
    title,
    price: raw.price,
    neighborhood: raw.neighborhood,
    train: raw.train,
    floor: raw.floor,
    elevator: raw.elevator,
    laundry: raw.laundry,
    pets: raw.pets,
    walkup_floor: walkupFloor(raw.floor, raw.elevator),
    photos: [],
    landlord: rng.pick(LANDLORDS),
    description,
  };
  if (raw.trap) listing.trap = raw.trap;
  if (raw.pair_with) listing.pair_with = raw.pair_with;
  return listing;
}

function ordinal(n: number): string {
  const s = ["th", "st", "nd", "rd"];
  const v = n % 100;
  return `${n}${s[(v - 20) % 10] ?? s[v] ?? s[0]}`;
}

function details(rng: Rng): Pick<Spec, "unit" | "cabinets" | "street" | "available" | "bed" | "adjective"> {
  return {
    unit: `${rng.int(1, 6)}${rng.pick(["A", "B", "C", "D", "F", "R"])}`,
    cabinets: rng.pick(CABINETS),
    street: `${rng.int(20, 980)} ${rng.pick(STREETS)}`,
    available: rng.pick(["Sept 1", "Sept 15", "Oct 1", "immediately"]),
    bed: rng.pick(["Studio", "1BR", "1BR", "2BR"]),
    adjective: rng.pick(["Sunny", "Quiet", "Renovated", "Bright", "Cozy", "Loft-style", "Corner", "Garden-level"]),
  };
}

/** A scripted hunt: three or four contrastive pairs plus a few singletons. Returns 12 listings. */
function hunt(rng: Rng, huntName: "hunt1" | "hunt2", firstId: number): Listing[] {
  const specs: Spec[] = [];
  let id = firstId;
  const add = (raw: Raw): Spec => {
    const spec: Spec = { id: id++, hunt: huntName, raw, ...details(rng) };
    specs.push(spec);
    return spec;
  };
  const pair = (good: Raw, badOverride: Partial<Raw>, trap: Listing["trap"]): void => {
    const g = add(good);
    const b = add({ ...good, ...badOverride, trap });
    b.bed = g.bed;
    b.adjective = g.adjective;
    b.street = g.street;
    g.raw.pair_with = `listing:${b.id}`;
    b.raw.pair_with = `listing:${g.id}`;
  };

  // Laundry pair: identical, one lacks laundry.
  pair(base(rng, { laundry: true }), { laundry: false }, "no_laundry");
  // Walk-up pair: two 5th-floor units, one has an elevator.
  pair(base(rng, { floor: 5, elevator: true }), { elevator: false }, "walkup");
  // Train pair: same Williamsburg building, one listed by its G stop.
  pair(base(rng, { neighborhood: "Williamsburg" }), { train: "G" }, "off_l");
  // Budget pair: identical, one just over budget (never opened).
  const goodPrice = rng.pick([2700, 2750, 2775]);
  pair(base(rng, { price: goodPrice }), { price: goodPrice + rng.pick([175, 225, 300]) }, "over_budget");
  // Singletons: one clearly over budget, one off the L in another neighborhood, two more that pass.
  add(base(rng, { price: rng.int(30, 34) * 100, trap: "over_budget" }));
  const off = rng.pick(OFF_L);
  add(base(rng, { neighborhood: off, train: NEIGHBORHOODS[off]!, trap: "off_l" }));
  add(base(rng, { laundry: false, floor: 4, elevator: false, trap: "no_laundry" }));
  add(base(rng));
  return specs.map((s) => finish(rng, s));
}

/** The agent's live hunt: four traps and two good listings, all unseen before. */
function agentSet(rng: Rng, firstId: number): Listing[] {
  let id = firstId;
  const mk = (raw: Raw): Spec => ({ id: id++, hunt: "agent", raw, ...details(rng) });
  const off = rng.pick(OFF_L);
  return [
    mk(base(rng, { floor: 4, elevator: false, trap: "walkup" })),
    mk(base(rng, { laundry: false, trap: "no_laundry" })),
    mk(base(rng, { price: 2900 + rng.pick([0, 50]), trap: "over_budget" })),
    mk(base(rng, { neighborhood: off, train: NEIGHBORHOODS[off]!, trap: "off_l" })),
    mk(base(rng, { pets: false })),
    mk(base(rng, { pets: true })),
  ].map((s) => finish(rng, s));
}

/** After the voice note: two perfect listings that forbid pets, two that allow them. */
function rerunSet(rng: Rng, firstId: number): Listing[] {
  let id = firstId;
  const mk = (raw: Raw): Spec => ({ id: id++, hunt: "rerun", raw, ...details(rng) });
  return [
    mk(base(rng, { pets: false, trap: "no_pets" })),
    mk(base(rng, { pets: false, trap: "no_pets" })),
    mk(base(rng, { pets: true })),
    mk(base(rng, { pets: true })),
  ].map((s) => finish(rng, s));
}

/** Listings that appear in search results but in no scripted hunt. */
function pool(rng: Rng, firstId: number, count: number): Listing[] {
  const out: Listing[] = [];
  for (let i = 0; i < count; i++) {
    const neighborhood = rng.pick(Object.keys(NEIGHBORHOODS));
    const raw = base(rng, {
      neighborhood,
      train: NEIGHBORHOODS[neighborhood]!,
      price: rng.int(19, 36) * 100 + rng.pick([0, 50]),
      floor: rng.int(1, 6),
      elevator: rng.chance(0.3),
      laundry: rng.chance(0.6),
    });
    out.push(finish(rng, { id: firstId + i, hunt: "pool", raw, ...details(rng) }));
  }
  return out;
}

export function generateListings(rng: Rng): Listing[] {
  return [...hunt(rng, "hunt1", 101), ...hunt(rng, "hunt2", 201), ...agentSet(rng, 301), ...rerunSet(rng, 401), ...pool(rng, 501, 26)];
}
