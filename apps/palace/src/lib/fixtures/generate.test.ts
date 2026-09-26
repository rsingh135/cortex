import { DEFAULT_PARAMS, ROOMS, aliveLevelsOn, ceilingOf, clarity, confidence } from "@cortex/schema";
import { describe, expect, it } from "vitest";
import { snapshotBytes } from "../bytes";
import { recallStateOn } from "../sweep";
import { FIXTURE_IDS, generateFixture } from "./generate";
import { fixtureScreenKey } from "./screenUrl";

const snapshot = generateFixture(42);

describe("generateFixture", () => {
  it("is deterministic per seed and differs across seeds", () => {
    expect(generateFixture(42)).toEqual(snapshot);
    expect(generateFixture(7).beliefs.map((b) => b.id)).not.toEqual(snapshot.beliefs.map((b) => b.id));
  });

  it("has about 120 beliefs, about 200 captures, and every room non-empty", () => {
    expect(snapshot.day).toBe(24);
    expect(snapshot.beliefs.length).toBeGreaterThanOrEqual(110);
    expect(snapshot.beliefs.length).toBeLessThanOrEqual(135);
    expect(snapshot.captures.length).toBeGreaterThanOrEqual(190);
    expect(snapshot.captures.length).toBeLessThanOrEqual(215);
    for (const room of ROOMS) expect(snapshot.beliefs.filter((b) => b.room === room && b.status === "active").length, room).toBeGreaterThan(0);
    const housing = snapshot.beliefs.filter((b) => b.room === "Housing").length;
    for (const room of ROOMS) expect(snapshot.beliefs.filter((b) => b.room === room).length).toBeLessThanOrEqual(housing);
  });

  it("has unique ids across all collections", () => {
    const ids = [...snapshot.beliefs, ...snapshot.captures, ...snapshot.procedures, ...snapshot.edges].map((x) => x.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("every edge endpoint and every evidence id exists", () => {
    const ids = new Set([...snapshot.beliefs, ...snapshot.captures, ...snapshot.procedures].map((x) => x.id));
    for (const e of snapshot.edges) {
      expect(ids.has(e.from), `edge ${e.id} from`).toBe(true);
      expect(ids.has(e.to), `edge ${e.id} to`).toBe(true);
    }
    const captureIds = new Set(snapshot.captures.map((c) => c.id));
    for (const b of snapshot.beliefs) for (const c of b.evidence) expect(captureIds.has(c), `${b.id} evidence ${c}`).toBe(true);
    for (const p of snapshot.procedures) for (const s of p.steps) for (const u of s.uses) expect(ids.has(u)).toBe(true);
    const types = new Set(snapshot.edges.map((e) => e.type));
    expect([...types].sort()).toEqual(["derived_from", "evidence", "supersedes", "uses"]);
  });

  it("computes capture state with the shared forgetting math", () => {
    for (const c of snapshot.captures) {
      const rs = recallStateOn(c.day, c.recallDays, snapshot.day);
      const alive = aliveLevelsOn("cortex", snapshot.day, rs.lastRecallDay, rs.recalls, DEFAULT_PARAMS);
      expect(c.aliveLevels).toEqual(alive);
      expect(c.ceiling).toBe(ceilingOf(alive));
      expect(c.clarity).toBeCloseTo(clarity("cortex", c.ceiling, snapshot.day - rs.lastRecallDay, rs.recalls, DEFAULT_PARAMS));
      expect(c.recalls).toBe(rs.recalls);
      // Fixture textures are cheap keys resolved lazily by the renderer, never data URLs in the snapshot.
      if (c.ceiling === null) expect(c.textureUrl).toBeNull();
      else expect(c.textureUrl).toBe(fixtureScreenKey(c, 42));
    }
    const recalledHunt1 = snapshot.captures.filter((c) => c.day === 2 && c.recallDays.length > 0);
    const forgottenHunt1 = snapshot.captures.filter((c) => c.day === 2 && c.recallDays.length === 0);
    expect(recalledHunt1.length).toBe(14);
    for (const c of recalledHunt1) expect(c.aliveLevels.includes("L0") || c.aliveLevels.includes("L1")).toBe(true);
    for (const c of forgottenHunt1) expect(c.aliveLevels).toEqual([]);
  });

  it("computes belief confidence with the shared forgetting math", () => {
    for (const b of snapshot.beliefs) {
      const rs = recallStateOn(b.createdDay, b.recallDays, snapshot.day);
      const human = b.source === "voice" || b.source === "manual";
      expect(b.confidence).toBeCloseTo(confidence("cortex", b.c0, snapshot.day - rs.lastRecallDay, rs.recalls, { humanSourced: human, pinned: b.pinned }, DEFAULT_PARAMS));
      expect(b.recalls).toBe(rs.recalls);
    }
  });

  it("contains the story beats", () => {
    const byId = new Map(snapshot.beliefs.map((b) => [b.id, b]));
    for (const id of [FIXTURE_IDS.budgetPreference, FIXTURE_IDS.laundryPreference, FIXTURE_IDS.floorPreference, FIXTURE_IDS.trainPreference]) {
      const b = byId.get(id);
      expect(b?.kind).toBe("preference");
      expect(b?.source).toBe("learner");
      expect(b?.ruleText).toBeTruthy();
      expect(b?.confidence ?? 0).toBeGreaterThan(0.6);
    }
    expect(byId.get(FIXTURE_IDS.stylePreference)?.kind).toBe("style");
    expect(byId.get(FIXTURE_IDS.leasePinned)?.pinned).toBe(true);
    expect(byId.get(FIXTURE_IDS.leasePinned)?.confidence).toBe(1);
    const pets = byId.get(FIXTURE_IDS.petsInferred);
    expect(pets?.inferred).toBe(true);
    expect(snapshot.edges.some((e) => e.type === "derived_from" && e.from === FIXTURE_IDS.petsInferred && e.to === FIXTURE_IDS.dogFact)).toBe(true);
    const superseded = snapshot.beliefs.filter((b) => b.status === "superseded");
    expect(superseded.map((b) => b.id).sort()).toEqual([...FIXTURE_IDS.budgetSuperseded].sort());
    expect(snapshot.edges.filter((e) => e.type === "supersedes")).toHaveLength(3);
    expect(snapshot.procedures).toHaveLength(2);
    expect(snapshot.procedures.find((p) => p.id === FIXTURE_IDS.apartmentHunt)?.status).toBe("active");
    const cracked = snapshot.procedures.find((p) => p.id === FIXTURE_IDS.scheduleViewings);
    expect(cracked?.status).toBe("cracked");
    expect(cracked?.crackedBy).toEqual([FIXTURE_IDS.petsInferred]);
  });

  it("accounts bytes like the simulator", () => {
    expect(snapshot.bytes).toEqual(snapshotBytes(snapshot.captures, snapshot.day));
    expect(snapshot.bytes.cortex).toBeGreaterThan(0);
    expect(snapshot.bytes.cortex).toBeLessThan(snapshot.bytes.keepAll * 0.5);
  });
});
