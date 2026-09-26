import { describe, expect, it } from "vitest";
import type { BeliefState, CaptureState } from "@cortex/schema";
import { planRecall, planSweep, type BeliefMeta } from "../src/forgetting/plan.js";

const cap = (id: string, day: number, recalls = 0, lastRecallDay = day): CaptureState => ({
  _id: `cs-${id}`,
  condition: "cortex",
  capture_id: id,
  alive_levels: ["L0", "L1", "L2", "L3"],
  ceiling: "L0",
  clarity: 1,
  recalls,
  last_recall_day: lastRecallDay,
});
const bel = (id: string, day: number, status: BeliefState["status"] = "active"): BeliefState => ({
  _id: `bs-${id}`,
  condition: "cortex",
  belief_id: id,
  confidence: 0.3,
  recalls: 0,
  last_recall_day: day,
  status,
  superseded_by: null,
});
const meta = (entries: BeliefMeta[]) => new Map(entries.map((m) => [m.belief_id, m]));

describe("planSweep", () => {
  it("deletes expired levels and lowers the ceiling", () => {
    const plan = planSweep("cortex", 12, [cap("c1", 2)], [], meta([]));
    expect(plan.captures[0]!.deleteLevels).toEqual(["L0", "L1", "L2"]);
    expect(plan.captures[0]!.next.ceiling).toBe("L3");
    expect(plan.levels_deleted).toBe(3);
    expect(plan.captures_forgotten).toBe(0);
  });
  it("counts a capture as forgotten when its last level goes", () => {
    const plan = planSweep("cortex", 24, [cap("c1", 2)], [], meta([]));
    expect(plan.captures[0]!.next.alive_levels).toEqual([]);
    expect(plan.captures_forgotten).toBe(1);
  });
  it("recalled captures survive where unrecalled ones do not", () => {
    const plan = planSweep("cortex", 24, [cap("kept", 2, 4, 18), cap("lost", 2)], [], meta([]));
    const kept = plan.captures.find((c) => c.capture_id === "kept")!;
    expect(kept.deleteLevels).toEqual([]);
    expect(kept.next.ceiling).toBe("L0");
  });
  it("keep_all never deletes; blur_by_age rows (whose clock never resets) are gone by day 24", () => {
    expect(planSweep("keep_all", 30, [{ ...cap("c1", 2), condition: "keep_all" }], [], meta([])).levels_deleted).toBe(0);
    expect(planSweep("blur_by_age", 24, [{ ...cap("c1", 2), condition: "blur_by_age" }], [], meta([])).captures[0]!.next.alive_levels).toEqual([]);
  });
  it("decays beliefs and forgets weak ones with no alive evidence", () => {
    const weak: BeliefMeta = { belief_id: "b1", c0: 0.3, humanSourced: false, pinned: false, evidence: ["c1"] };
    const voice: BeliefMeta = { belief_id: "b2", c0: 0.9, humanSourced: true, pinned: false, evidence: [] };
    const plan = planSweep("cortex", 40, [cap("c1", 2)], [bel("b1", 2), bel("b2", 25)], meta([weak, voice]));
    const b1 = plan.beliefs.find((b) => b.belief_id === "b1")!;
    const b2 = plan.beliefs.find((b) => b.belief_id === "b2")!;
    expect(b1.forgotten).toBe(true);
    expect(b1.next.status).toBe("forgotten");
    expect(b2.forgotten).toBe(false);
    expect(b2.next.confidence).toBeGreaterThan(0.7);
    expect(plan.beliefs_forgotten).toBe(1);
  });
  it("skips superseded and tombstoned beliefs", () => {
    const m: BeliefMeta = { belief_id: "b1", c0: 0.3, humanSourced: false, pinned: false, evidence: [] };
    expect(planSweep("cortex", 40, [], [bel("b1", 2, "superseded")], meta([m])).beliefs).toEqual([]);
  });
});

describe("planRecall", () => {
  it("resets the belief clock and cascades to evidence captures once", () => {
    const plan = planRecall("cortex", 24, bel("b1", 5), 0.8, [cap("c1", 2, 1, 6), cap("c2", 2)], new Set(["c2"]));
    expect(plan.belief.recalls).toBe(1);
    expect(plan.belief.last_recall_day).toBe(24);
    expect(plan.belief.confidence).toBe(0.8);
    expect(plan.captures.map((c) => c.capture_id)).toEqual(["c1"]);
    expect(plan.captures[0]!.recalls).toBe(2);
    expect(plan.captures[0]!.last_recall_day).toBe(24);
    expect(plan.captures[0]!.clarity).toBe(1);
  });
  it("leaves blur_by_age state untouched", () => {
    const plan = planRecall("blur_by_age", 24, { ...bel("b1", 5), condition: "blur_by_age" }, 0.8, [{ ...cap("c1", 2), condition: "blur_by_age" }], new Set());
    expect(plan.belief.recalls).toBe(0);
    expect(plan.captures[0]!.recalls).toBe(0);
  });
});
