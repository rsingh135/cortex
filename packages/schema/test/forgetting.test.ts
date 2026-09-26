import { describe, expect, it } from "vitest";
import {
  DEFAULT_PARAMS,
  aliveLevelsOn,
  applyCaptureRecall,
  ceilingOf,
  clarity,
  confidence,
  expiresDay,
  isForgotten,
  learnerConfidence,
  lifetimeDays,
  recallMultiplier,
  reinforce,
  servedLevel,
} from "../src/forgetting.js";

describe("recall multiplier", () => {
  it("doubles per recall and caps at 8", () => {
    expect(recallMultiplier(0)).toBe(1);
    expect(recallMultiplier(1)).toBe(2);
    expect(recallMultiplier(3)).toBe(8);
    expect(recallMultiplier(6)).toBe(8);
  });
});

describe("level lifetimes", () => {
  it("uses base days at zero recalls", () => {
    expect(lifetimeDays("L0", 0)).toBe(2);
    expect(lifetimeDays("L1", 0)).toBe(5);
    expect(lifetimeDays("L2", 0)).toBe(10);
    expect(lifetimeDays("L3", 0)).toBe(20);
  });
  it("expires relative to the last recall day", () => {
    expect(expiresDay("L0", 2, 0)).toBe(4);
    expect(expiresDay("L3", 2, 0)).toBe(22);
    expect(expiresDay("L0", 13, 3)).toBe(13 + 16);
  });
});

describe("alive levels by condition", () => {
  it("cortex without recalls loses everything from day 2 by day 22", () => {
    expect(aliveLevelsOn("cortex", 3, 2, 0)).toEqual(["L0", "L1", "L2", "L3"]);
    expect(aliveLevelsOn("cortex", 4, 2, 0)).toEqual(["L1", "L2", "L3"]);
    expect(aliveLevelsOn("cortex", 12, 2, 0)).toEqual(["L3"]);
    expect(aliveLevelsOn("cortex", 22, 2, 0)).toEqual([]);
  });
  it("keep_all never loses a level", () => {
    expect(aliveLevelsOn("keep_all", 999, 2, 0)).toEqual(["L0", "L1", "L2", "L3"]);
  });
  it("blur_by_age ignores recalls", () => {
    expect(aliveLevelsOn("blur_by_age", 22, 2, 5)).toEqual([]);
    expect(aliveLevelsOn("cortex", 22, 2, 5)).toEqual(["L1", "L2", "L3"]);
  });
  it("ceiling is the sharpest alive level", () => {
    expect(ceilingOf(["L2", "L3"])).toBe("L2");
    expect(ceilingOf([])).toBeNull();
  });
});

describe("clarity", () => {
  it("equals the ceiling value at the moment of recall", () => {
    expect(clarity("cortex", "L0", 0, 0)).toBeCloseTo(1);
    expect(clarity("cortex", "L2", 0, 0)).toBeCloseTo(0.5);
  });
  it("halves every 4 days at zero recalls", () => {
    expect(clarity("cortex", "L0", 4, 0)).toBeCloseTo(0.5, 5);
    expect(clarity("cortex", "L0", 8, 0)).toBeCloseTo(0.25, 5);
  });
  it("decays slower with recalls", () => {
    expect(clarity("cortex", "L0", 8, 1)).toBeCloseTo(0.5, 5);
  });
  it("is 0 when forgotten and 1 for keep_all", () => {
    expect(clarity("cortex", null, 1, 0)).toBe(0);
    expect(clarity("keep_all", "L3", 100, 0)).toBe(1);
  });
});

describe("served level", () => {
  it("picks the sharpest alive level at or below the clarity", () => {
    const all = ["L0", "L1", "L2", "L3"] as const;
    expect(servedLevel(all, 1)).toBe("L0");
    expect(servedLevel(all, 0.8)).toBe("L1");
    expect(servedLevel(all, 0.6)).toBe("L2");
    expect(servedLevel(all, 0.3)).toBe("L3");
  });
  it("falls back to the lowest alive level when clarity is below every value", () => {
    expect(servedLevel(["L1", "L2"], 0.1)).toBe("L2");
    expect(servedLevel([], 0.9)).toBeNull();
  });
  it("never serves a level sharper than the ceiling", () => {
    expect(servedLevel(["L2", "L3"], 1)).toBe("L2");
  });
});

describe("belief confidence", () => {
  it("halves every 20 days at zero recalls", () => {
    expect(confidence("cortex", 0.8, 20, 0)).toBeCloseTo(0.4, 5);
  });
  it("human-sourced beliefs decay at a quarter rate", () => {
    expect(confidence("cortex", 0.9, 20, 0, { humanSourced: true })).toBeCloseTo(0.9 * Math.pow(0.5, 0.25), 5);
  });
  it("pinned and keep_all never decay", () => {
    expect(confidence("cortex", 1, 100, 0, { pinned: true })).toBe(1);
    expect(confidence("keep_all", 0.3, 100, 0)).toBe(0.3);
  });
  it("a voice note at 0.9 is still above 0.5 after 30 days", () => {
    expect(confidence("cortex", 0.9, 30, 0, { humanSourced: true })).toBeGreaterThan(0.5);
  });
  it("reinforce moves 30% toward 1", () => {
    expect(reinforce(0.5)).toBeCloseTo(0.65);
    expect(reinforce(1)).toBe(1);
  });
  it("learner confidence grows with explained decisions and pairs, capped", () => {
    expect(learnerConfidence(2, 1)).toBeCloseTo(0.8);
    expect(learnerConfidence(10, 5)).toBe(DEFAULT_PARAMS.c0.learnerCap);
  });
  it("forgotten only when weak and evidence-less", () => {
    expect(isForgotten(0.05, 0)).toBe(true);
    expect(isForgotten(0.05, 1)).toBe(false);
    expect(isForgotten(0.5, 0)).toBe(false);
  });
});

describe("recall application", () => {
  it("cortex snaps clarity to ceiling and resets the clock", () => {
    const out = applyCaptureRecall("cortex", { recalls: 1, lastRecallDay: 2, ceiling: "L1" }, 9);
    expect(out).toEqual({ recalls: 2, lastRecallDay: 9, clarity: 0.75 });
  });
  it("blur_by_age leaves state untouched", () => {
    const out = applyCaptureRecall("blur_by_age", { recalls: 0, lastRecallDay: 2, ceiling: "L1" }, 9);
    expect(out.recalls).toBe(0);
    expect(out.lastRecallDay).toBe(2);
    expect(out.clarity).toBeLessThan(0.75);
  });
});
