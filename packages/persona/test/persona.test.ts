import { describe, expect, it } from "vitest";
import { checkRules, findContrastivePairs, type DecisionLike, type Rule } from "@cortex/schema";
import { generatePersona } from "../src/generate/index.js";
import { decide, TRUE_RULES } from "../src/generate/decisions.js";
import { HUNT_DAYS } from "../src/generate/script.js";

const persona = generatePersona(42);
const { listings, script, groundTruth, usageLog } = persona;

function decisionsFor(hunt: "hunt1" | "hunt2"): DecisionLike[] {
  return listings
    .filter((l) => l.hunt === hunt)
    .map((l) => ({
      _id: `${hunt}:${l._id}`,
      listing_id: l._id,
      attrs: { price: l.price, neighborhood: l.neighborhood, train: l.train, floor: l.floor, elevator: l.elevator, laundry: l.laundry, pets: l.pets, walkup_floor: l.walkup_floor },
      outcome: decide(l, HUNT_DAYS[hunt]),
    }));
}

describe("persona generation", () => {
  it("is deterministic", () => {
    expect(JSON.stringify(generatePersona(42))).toBe(JSON.stringify(persona));
    expect(JSON.stringify(generatePersona(7))).not.toBe(JSON.stringify(persona));
  });

  it("has about 60 listings with unique ids and every hunt populated", () => {
    expect(listings.length).toBe(60);
    expect(new Set(listings.map((l) => l._id)).size).toBe(60);
    for (const h of ["hunt1", "hunt2", "agent", "rerun", "pool"] as const) expect(listings.some((l) => l.hunt === h)).toBe(true);
  });

  it("each scripted hunt has a contrastive pair for every learnable rule", () => {
    for (const hunt of ["hunt1", "hunt2"] as const) {
      const pairs = findContrastivePairs(decisionsFor(hunt));
      const attrs = new Set(pairs.map((p) => p.attr));
      expect(attrs).toContain("laundry");
      expect(attrs).toContain("elevator");
      expect(attrs).toContain("train");
      expect(attrs).toContain("price");
    }
  });

  it("the rule checker recovers exactly the true rules and drops decoys", () => {
    const decisions = [...decisionsFor("hunt1"), ...decisionsFor("hunt2")];
    const proposed: Rule[] = [
      { attr: "price", op: "<=", value: 2700, then: "skip", support: [] },
      { attr: "laundry", op: "==", value: true, then: "skip", support: [] },
      { attr: "walkup_floor", op: "<=", value: 3, then: "skip", support: [] },
      { attr: "train", op: "==", value: "L", then: "skip", support: [] },
      // decoys
      { attr: "neighborhood", op: "==", value: "Bushwick", then: "skip", support: [] },
      { attr: "elevator", op: "==", value: true, then: "skip", support: [] },
      { attr: "floor", op: "<=", value: 3, then: "skip", support: [] },
      { attr: "pets", op: "==", value: true, then: "skip", support: [] },
    ];
    const survivors = checkRules(proposed, decisions);
    const attrs = survivors.map((s) => s.rule.attr).sort();
    expect(attrs).toEqual(["laundry", "price", "train", "walkup_floor"]);
    const price = survivors.find((s) => s.rule.attr === "price")!;
    expect(price.rule.value).toBeGreaterThanOrEqual(2775);
    expect(price.rule.value).toBeLessThan(3000);
    for (const s of survivors) expect(s.pairs).toBeGreaterThanOrEqual(1);
  });

  it("the agent set has one of each trap plus two good listings; the rerun set splits on pets only", () => {
    const agent = listings.filter((l) => l.hunt === "agent");
    expect(agent.map((l) => l.trap).filter(Boolean).sort()).toEqual(["no_laundry", "off_l", "over_budget", "walkup"]);
    expect(agent.filter((l) => decide(l, 24) === "messaged").length).toBe(2);
    const rerun = listings.filter((l) => l.hunt === "rerun");
    expect(rerun.filter((l) => decide(l, 24) === "messaged").length).toBe(4);
    expect(rerun.filter((l) => decide(l, 25) === "messaged").length).toBe(2);
    expect(rerun.filter((l) => l.trap === "no_pets").length).toBe(2);
  });

  it("script opens only listings that exist and never opens over-budget ones", () => {
    const ids = new Set(listings.map((l) => l._id));
    const opened = script.filter((s) => s.action === "open" && s.target?.startsWith("/listings/listing:")).map((s) => s.target!.replace("/listings/", ""));
    expect(opened.length).toBeGreaterThan(10);
    for (const id of opened) {
      expect(ids.has(id)).toBe(true);
      expect(listings.find((l) => l._id === id)!.price).toBeLessThanOrEqual(2800);
    }
    expect(script.filter((s) => s.action === "message").length).toBeGreaterThanOrEqual(6);
    expect(new Set(script.map((s) => s.episode)).size).toBeGreaterThan(20);
  });

  it("questions are 20 / 20 / 10 with unique ids and non-empty answers", () => {
    const qs = groundTruth.questions;
    expect(qs.length).toBe(50);
    expect(new Set(qs.map((q) => q.id)).size).toBe(50);
    const by = (g: string) => qs.filter((q) => q.group === g).length;
    expect([by("used_often"), by("seen_once"), by("rare_important")]).toEqual([20, 20, 10]);
    for (const q of qs) expect(q.answer.trim().length).toBeGreaterThan(0);
    const ids = new Set(listings.map((l) => l._id));
    for (const q of qs.filter((q) => q.evidence_capture_hint?.startsWith("listing:"))) expect(ids.has(q.evidence_capture_hint!)).toBe(true);
  });

  it("ground truth carries the five rules and the pets rule activates on day 25", () => {
    expect(groundTruth.rules).toEqual(TRUE_RULES);
    expect(groundTruth.rules.find((r) => r.attr === "pets")?.active_from_day).toBe(25);
  });

  it("usage log recalls housing on the simulator's days", () => {
    const housingDays = usageLog.filter((u) => u.rooms.includes("Housing") && u.kind === "question").map((u) => u.day);
    for (const d of [3, 6, 13, 18]) expect(housingDays).toContain(d);
  });
});
