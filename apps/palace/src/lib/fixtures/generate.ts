/**
 * Maya's month as a PalaceSnapshot. Seeded and pure: `generateFixture(42)` is the same object
 * every time, in the browser and in tests. Forgetting state comes from @cortex/schema through
 * `sweep.ts`; nothing here re-derives the math.
 */
import { DEFAULT_PARAMS, ROOMS, describeRule, learnerConfidence, type App, type Kind, type Room, type Rule } from "@cortex/schema";
import { DEFAULT_L0_BYTES, snapshotBytes } from "../bytes";
import { beliefConfidenceOn, captureStateOn, recallStateOn } from "../sweep";
import type { PalaceBelief, PalaceCapture, PalaceEdge, PalaceProcedure, PalaceSnapshot } from "../types";
import {
  CALENDAR_TITLES,
  CAPTURE_TITLES,
  HOUSING_FACTS,
  HOUSING_PERSONS,
  HOUSING_RECALL_DAYS,
  INBOX_SUBJECTS,
  LANDLORDS,
  NEIGHBORHOODS,
  REJECTION_REASONS,
  ROOM_TARGETS,
  ROOM_TEMPLATES,
  TRAINS,
  type BeliefTemplate,
} from "./content";
import { createPrng, type Prng } from "./prng";
import { fixtureScreenKey } from "./screenUrl";

export const DEFAULT_SEED = 42;
export const DEFAULT_FIXTURE_DAY = 24;

/** Well-known ids other tracks can point the camera at. Stable across seeds. */
export const FIXTURE_IDS = {
  budgetPreference: "blf_pref_budget",
  laundryPreference: "blf_pref_laundry",
  floorPreference: "blf_pref_floor",
  trainPreference: "blf_pref_train",
  stylePreference: "blf_style_messages",
  leasePinned: "blf_lease_signing",
  dogFact: "blf_fact_dog",
  petsInferred: "blf_pref_pets",
  budgetSuperseded: ["blf_budget_v1", "blf_budget_v2", "blf_budget_v3"],
  apartmentHunt: "prc_apartment_hunt",
  scheduleViewings: "prc_schedule_viewings",
} as const;

interface FixtureCapture extends PalaceCapture {
  room: Room;
  group: string;
  recalledCohort: boolean;
}

interface Ctx {
  prng: Prng;
  day: number;
  seed: number;
  captures: FixtureCapture[];
  beliefs: PalaceBelief[];
  edges: PalaceEdge[];
  ids: Set<string>;
}

export function generateFixture(seed: number = DEFAULT_SEED, day: number = DEFAULT_FIXTURE_DAY): PalaceSnapshot {
  const root = createPrng(seed);
  const ctx: Ctx = { prng: root.fork(), day, seed, captures: [], beliefs: [], edges: [], ids: new Set() };

  generateCaptures(ctx, root.fork());
  const housing = generateHousing(ctx, root.fork());
  for (const room of ROOMS) if (room !== "Housing") generateRoom(ctx, root.fork(), room, ROOM_TARGETS[room]);
  const procedures = generateProcedures(ctx, housing);

  const captures: PalaceCapture[] = ctx.captures.map((c) => {
    const state = captureStateOn(c, day);
    const base: PalaceCapture = { id: c.id, app: c.app, title: c.title, day: c.day, url: c.url, l0Bytes: c.l0Bytes, recallDays: c.recallDays, textureUrl: null, ...state };
    return { ...base, textureUrl: fixtureScreenKey(base, seed) };
  });

  const beliefs = ctx.beliefs.map((b) => {
    const rs = recallStateOn(b.createdDay, b.recallDays, day);
    return { ...b, confidence: beliefConfidenceOn(b, day), recalls: rs.recalls, lastRecallDay: rs.lastRecallDay };
  });

  return { day, beliefs, captures, procedures, edges: ctx.edges, bytes: snapshotBytes(captures, day) };
}

// ---------------------------------------------------------------------------
// Captures
// ---------------------------------------------------------------------------

interface CaptureGroup {
  label: string;
  room: Room;
  day: number;
  count: number;
  apps: App[];
  recalledFraction: number;
}

function captureGroups(prng: Prng): CaptureGroup[] {
  const groups: CaptureGroup[] = [
    { label: "setup", room: "Work", day: 1, count: 15, apps: ["inbox", "calendar"], recalledFraction: 0 },
    { label: "hunt1", room: "Housing", day: 2, count: 40, apps: ["mockloft", "mockloft", "mockloft", "landlord_chat"], recalledFraction: 0.35 },
    { label: "hunt2", room: "Housing", day: 5, count: 40, apps: ["mockloft", "mockloft", "mockloft", "landlord_chat"], recalledFraction: 0.35 },
  ];
  const lifeRooms: Room[] = ["Work", "Work", "Social", "Health", "Errands", "Misc"];
  for (let d = 3; d <= 20; d++) {
    if (d === 5) continue;
    for (const room of prng.shuffle(lifeRooms).slice(0, 3)) {
      groups.push({ label: `life${d}`, room, day: d, count: 2, apps: appsFor(room), recalledFraction: 0 });
    }
  }
  return groups;
}

function appsFor(room: Room): App[] {
  switch (room) {
    case "Housing":
      return ["mockloft", "landlord_chat"];
    case "Work":
    case "Social":
      return ["inbox", "calendar"];
    case "Health":
      return ["calendar"];
    case "Errands":
    case "Misc":
      return ["inbox"];
  }
}

function generateCaptures(ctx: Ctx, prng: Prng): void {
  let index = 0;
  for (const g of captureGroups(prng)) {
    const recalledCount = Math.round(g.count * g.recalledFraction);
    for (let i = 0; i < g.count; i++) {
      const app = prng.pick(g.apps);
      const recalled = i < recalledCount;
      const id = uniqueId(ctx, `cap_${String(g.day).padStart(2, "0")}_${String(index).padStart(3, "0")}`, prng);
      index += 1;
      ctx.captures.push({
        id,
        app,
        title: captureTitle(prng, app, g.day),
        day: g.day,
        url: captureUrl(prng, app),
        l0Bytes: Math.round(DEFAULT_L0_BYTES * prng.range(0.85, 1.15)),
        recallDays: recalled && g.room === "Housing" ? [...HOUSING_RECALL_DAYS] : [],
        aliveLevels: [],
        ceiling: null,
        clarity: 0,
        recalls: 0,
        lastRecallDay: g.day,
        textureUrl: null,
        room: g.room,
        group: g.label,
        recalledCohort: recalled,
      });
    }
  }
}

function captureTitle(prng: Prng, app: App, day: number): string {
  const template = prng.pick(CAPTURE_TITLES[app]);
  return template
    .replace("{hood}", prng.pick(NEIGHBORHOODS))
    .replace("{price}", String(prng.int(21, 31) * 100))
    .replace("{id}", String(prng.int(200, 260)))
    .replace("{subject}", prng.pick(INBOX_SUBJECTS))
    .replace("{title}", prng.pick(CALENDAR_TITLES).replace("{id}", String(prng.int(200, 260))))
    .replace("{landlord}", prng.pick(LANDLORDS))
    .replace("{d}", String(day));
}

function captureUrl(prng: Prng, app: App): string {
  switch (app) {
    case "mockloft":
      return `https://mockloft.local/listings/${prng.int(200, 260)}`;
    case "inbox":
      return `https://inbox.local/thread/${prng.hex(6)}`;
    case "calendar":
      return "https://calendar.local/week";
    case "landlord_chat":
      return `https://mockloft.local/listings/${prng.int(200, 260)}/chat`;
  }
}

// ---------------------------------------------------------------------------
// Beliefs
// ---------------------------------------------------------------------------

interface BeliefInput {
  id?: string;
  text: string;
  kind: Kind;
  room: Room;
  source?: PalaceBelief["source"];
  inferred?: boolean;
  pinned?: boolean;
  status?: PalaceBelief["status"];
  c0?: number;
  createdDay: number;
  evidence?: string[];
  recallDays?: number[];
  rule?: Rule;
  history?: PalaceBelief["history"];
  supersededBy?: string | null;
}

function addBelief(ctx: Ctx, input: BeliefInput): PalaceBelief {
  const source = input.source ?? "screen";
  const c0 = input.c0 ?? (input.pinned ? DEFAULT_PARAMS.c0.pinned : source === "voice" ? DEFAULT_PARAMS.c0.voice : source === "manual" ? DEFAULT_PARAMS.c0.manual : DEFAULT_PARAMS.c0.screenEvent);
  const id = input.id ? claimId(ctx, input.id) : uniqueId(ctx, `blf_${input.room.toLowerCase()}_${input.kind}`, ctx.prng);
  const belief: PalaceBelief = {
    id,
    text: input.text,
    kind: input.kind,
    room: input.room,
    source,
    inferred: input.inferred ?? false,
    pinned: input.pinned ?? false,
    status: input.status ?? "active",
    confidence: c0,
    recalls: 0,
    evidence: input.evidence ?? [],
    createdDay: input.createdDay,
    history: input.history ?? [{ day: input.createdDay, event: "created", note: `${source} capture` }],
    ruleText: input.rule ? describeRule(input.rule) : undefined,
    c0,
    recallDays: input.recallDays ?? [],
    lastRecallDay: input.createdDay,
    supersededBy: input.supersededBy ?? null,
  };
  ctx.beliefs.push(belief);
  for (const captureId of belief.evidence) addEdge(ctx, belief.id, captureId, "evidence");
  return belief;
}

function addEdge(ctx: Ctx, from: string, to: string, type: PalaceEdge["type"]): void {
  const id = `edg_${type}_${from}_${to}`;
  if (ctx.ids.has(id)) return;
  ctx.ids.add(id);
  ctx.edges.push({ id, from, to, type });
}

interface HousingIds {
  preferences: string[];
  style: string;
  pets: string;
  budget: string;
  laundry: string;
  floor: string;
  train: string;
}

function generateHousing(ctx: Ctx, prng: Prng): HousingIds {
  const hunt1 = ctx.captures.filter((c) => c.group === "hunt1");
  const hunt2 = ctx.captures.filter((c) => c.group === "hunt2");
  const recalled = [...hunt1, ...hunt2].filter((c) => c.recalledCohort);
  const unrecalled = [...hunt1, ...hunt2].filter((c) => !c.recalledCohort);
  const pickRecalled = (n: number) => prng.sample(recalled, n).map((c) => c.id);
  const pickUnrecalled = (n: number) => prng.sample(unrecalled, n).map((c) => c.id);
  const recallsAfter = (day: number) => HOUSING_RECALL_DAYS.filter((d) => d > day);

  // Hunt events. Rejections and messages feed the learner and stay sharp through recalls.
  const rejections: string[] = [];
  const messages: string[] = [];
  for (const [huntIndex, hunt] of [hunt1, hunt2].entries()) {
    const day = hunt[0]?.day ?? 2;
    const listingIds = prng.shuffle(Array.from({ length: 12 }, (_, i) => 200 + huntIndex * 30 + i));
    listingIds.forEach((listing, i) => {
      const hood = prng.pick(NEIGHBORHOODS);
      const train = prng.pick(TRAINS);
      const price = prng.int(22, 30) * 100;
      if (i < 3) {
        const b = addBelief(ctx, { text: `Rejected listing ${listing} (${hood}): ${prng.pick(REJECTION_REASONS)}`, kind: "event", room: "Housing", createdDay: day, evidence: pickRecalled(2), recallDays: recallsAfter(day) });
        rejections.push(b.id);
      } else if (i < 5) {
        const b = addBelief(ctx, { text: `Messaged the landlord of listing ${listing}, $${price.toLocaleString()} in ${hood} (${train})`, kind: "event", room: "Housing", createdDay: day, evidence: pickRecalled(2), recallDays: recallsAfter(day) });
        messages.push(b.id);
      } else {
        addBelief(ctx, { text: `Viewed listing ${listing}: $${price.toLocaleString()} one-bedroom in ${hood}, ${train} train`, kind: "event", room: "Housing", createdDay: day, evidence: pickUnrecalled(1) });
      }
    });
    addBelief(ctx, { text: `Hunt ${huntIndex + 1}: viewed 12 listings, rejected 3, messaged 2`, kind: "summary", room: "Housing", createdDay: day, evidence: pickUnrecalled(1) });
  }

  for (const t of HOUSING_FACTS) addBelief(ctx, { ...t, room: "Housing", createdDay: prng.pick([1, 2, 2, 5]), evidence: pickUnrecalled(1) });
  for (const t of HOUSING_PERSONS) addBelief(ctx, { ...t, room: "Housing", createdDay: prng.pick([2, 5]), evidence: pickRecalled(1), recallDays: recallsAfter(5) });

  // Superseded budget chain: each guess replaced by the next, the learner's rule replacing the last.
  const [v1, v2, v3] = FIXTURE_IDS.budgetSuperseded;
  addBelief(ctx, { id: v1, text: "Budget: at most $2,500/month", kind: "preference", room: "Housing", createdDay: 2, status: "superseded", c0: 0.5, evidence: pickUnrecalled(1), supersededBy: v2, history: [{ day: 2, event: "created" }, { day: 3, event: "superseded", note: "raised to $2,600" }] });
  addBelief(ctx, { id: v2, text: "Budget: at most $2,600/month", kind: "preference", room: "Housing", createdDay: 3, status: "superseded", c0: 0.5, evidence: pickUnrecalled(1), supersededBy: v3, history: [{ day: 3, event: "created" }, { day: 4, event: "superseded", note: "raised to $2,700" }] });
  addBelief(ctx, { id: v3, text: "Budget: at most $2,700/month", kind: "preference", room: "Housing", createdDay: 4, status: "superseded", c0: 0.5, evidence: pickUnrecalled(1), supersededBy: FIXTURE_IDS.budgetPreference, history: [{ day: 4, event: "created" }, { day: 5, event: "superseded", note: "learner settled on $2,800" }] });

  // The four learned preferences, day 5 after hunt 2.
  const learnerHistory = (note: string) => [{ day: 5, event: "learned", note }, ...HOUSING_RECALL_DAYS.filter((d) => d > 5).map((d) => ({ day: d, event: "recalled", note: "usage log" }))];
  const pref = (id: string, text: string, rule: Rule, explained: number, pairs: number) =>
    addBelief(ctx, { id, text, kind: "preference", room: "Housing", source: "learner", createdDay: 5, c0: learnerConfidence(explained, pairs), evidence: pickRecalled(5), recallDays: recallsAfter(5), rule, history: learnerHistory(`${explained} decisions explained, ${pairs} contrastive pairs`) });
  const budget = pref(FIXTURE_IDS.budgetPreference, "Budget: at most $2,800/month", { attr: "price", op: "<=", value: 2800, then: "skip", support: [] }, 6, 2);
  const laundry = pref(FIXTURE_IDS.laundryPreference, "Needs in-unit or in-building laundry", { attr: "laundry", op: "==", value: true, then: "skip", support: [] }, 5, 2);
  const floor = pref(FIXTURE_IDS.floorPreference, "No walk-ups above the 3rd floor", { attr: "floor", op: "<=", value: 3, then: "skip", support: [] }, 3, 1);
  const train = pref(FIXTURE_IDS.trainPreference, "Only listings near the L train", { attr: "train", op: "in", value: ["L"], then: "skip", support: [] }, 4, 1);
  addEdge(ctx, budget.id, v3, "supersedes");
  addEdge(ctx, v3, v2, "supersedes");
  addEdge(ctx, v2, v1, "supersedes");
  for (const [i, p] of [budget, laundry, floor, train].entries()) {
    for (const r of prng.sample(rejections, 2)) addEdge(ctx, p.id, r, "derived_from");
    if (i < 2) for (const m of prng.sample(messages, 1)) addEdge(ctx, p.id, m, "derived_from");
  }

  const style = addBelief(ctx, { id: FIXTURE_IDS.stylePreference, text: "Writes short, friendly messages; mentions a Sept 1 move-in and always asks about laundry", kind: "style", room: "Housing", source: "learner", createdDay: 5, c0: 0.8, evidence: pickRecalled(3), recallDays: recallsAfter(5), history: learnerHistory("from 4 landlord messages") });
  for (const m of messages.slice(0, 3)) addEdge(ctx, style.id, m, "derived_from");

  addBelief(ctx, { id: FIXTURE_IDS.leasePinned, text: "Lease signing is Friday Sept 26 at 10am at the broker's office", kind: "fact", room: "Housing", source: "voice", pinned: true, createdDay: 12, history: [{ day: 12, event: "created", note: "voice note" }, { day: 12, event: "pinned", note: "\"remember this one\"" }] });

  const dog = addBelief(ctx, { id: FIXTURE_IDS.dogFact, text: "Maya is getting a dog", kind: "fact", room: "Housing", source: "voice", createdDay: Math.min(ctx.day, 23), history: [{ day: Math.min(ctx.day, 23), event: "created", note: "voice note: \"I'm getting a dog\"" }] });
  const pets = addBelief(ctx, { id: FIXTURE_IDS.petsInferred, text: "Listings must allow pets", kind: "preference", room: "Housing", source: "voice", inferred: true, createdDay: dog.createdDay, rule: { attr: "pets", op: "==", value: true, then: "skip", support: [] }, history: [{ day: dog.createdDay, event: "inferred", note: "from the dog voice note" }] });
  addEdge(ctx, pets.id, dog.id, "derived_from");

  return { preferences: [budget.id, laundry.id, floor.id, train.id], style: style.id, pets: pets.id, budget: budget.id, laundry: laundry.id, floor: floor.id, train: train.id };
}

function generateRoom(ctx: Ctx, prng: Prng, room: Exclude<Room, "Housing">, target: number): void {
  const pool = ctx.captures.filter((c) => c.room === room);
  const templates = prng.shuffle(ROOM_TEMPLATES[room]);
  for (let i = 0; i < target; i++) {
    const t: BeliefTemplate = templates[i % templates.length];
    const day = prng.int(1, Math.min(ctx.day - 1, 20));
    const text = fill(t.text, day, prng, i >= templates.length ? ` (${prng.pick(["again", "follow-up", "v2"])})` : "");
    const near = pool.filter((c) => Math.abs(c.day - day) <= 2 && (!t.app || c.app === t.app));
    const evidencePool = near.length ? near : pool;
    const evidence = prng.sample(evidencePool, t.kind === "summary" ? 1 : prng.int(1, 2)).map((c) => c.id);
    addBelief(ctx, { text, kind: t.kind, room, createdDay: day, evidence, c0: t.kind === "summary" ? 0.5 : undefined });
  }
}

function fill(text: string, day: number, prng: Prng, suffix: string): string {
  return text.replace("{d}", String(day)).replace("{d2}", String(Math.min(30, day + prng.int(2, 9)))) + suffix;
}

// ---------------------------------------------------------------------------
// Procedures
// ---------------------------------------------------------------------------

function generateProcedures(ctx: Ctx, h: HousingIds): PalaceProcedure[] {
  const hunt: PalaceProcedure = {
    id: claimId(ctx, FIXTURE_IDS.apartmentHunt),
    name: "apartment_hunt",
    description: "Open MockLoft, filter by Maya's rules, skip violators, draft landlord messages in her voice, wait for approval.",
    room: "Housing",
    status: "active",
    steps: [
      { n: 1, do: "open_listings", uses: [] },
      { n: 2, do: "filter_listings", uses: [h.budget, h.train] },
      { n: 3, do: "decide", uses: [h.laundry, h.floor] },
      { n: 4, do: "draft_message", uses: [h.style] },
      { n: 5, do: "await_approval", uses: [] },
    ],
    crackedBy: [],
  };
  const viewings: PalaceProcedure = {
    id: claimId(ctx, FIXTURE_IDS.scheduleViewings),
    name: "schedule_viewings",
    description: "Pick messaged listings, propose viewing slots around work, message the landlord.",
    room: "Housing",
    status: "cracked",
    steps: [
      { n: 1, do: "open_calendar", uses: [] },
      { n: 2, do: "pick_listings", uses: [h.budget, h.pets] },
      { n: 3, do: "message_landlord", uses: [h.style] },
    ],
    crackedBy: [h.pets],
  };
  for (const p of [hunt, viewings]) for (const step of p.steps) for (const used of step.uses) addEdge(ctx, p.id, used, "uses");
  return [hunt, viewings];
}

// ---------------------------------------------------------------------------
// Ids
// ---------------------------------------------------------------------------

function claimId(ctx: Ctx, id: string): string {
  if (ctx.ids.has(id)) throw new Error(`duplicate fixture id ${id}`);
  ctx.ids.add(id);
  return id;
}

function uniqueId(ctx: Ctx, prefix: string, prng: Prng): string {
  for (;;) {
    const id = `${prefix}_${prng.hex(6)}`;
    if (!ctx.ids.has(id)) {
      ctx.ids.add(id);
      return id;
    }
  }
}
