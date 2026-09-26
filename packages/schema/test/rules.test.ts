import { describe, expect, it } from "vitest";
import {
  checkRule,
  checkRules,
  describeRule,
  findContrastivePairs,
  loosenThreshold,
  pairsSupporting,
  satisfies,
  thresholdRange,
  violatedRules,
  type DecisionLike,
} from "../src/rules.js";
import type { Rule } from "../src/rules.js";

const base = { neighborhood: "Bushwick", train: "L", floor: 2, elevator: false, laundry: true, pets: false, walkup_floor: 2 } as const;

/** Five listings: three contrastive pairs (laundry; elevator on a 5th floor; price) and no floor pair. */
const decisions: DecisionLike[] = [
  { _id: "d1", listing_id: "listing:101", attrs: { ...base, price: 2600 }, outcome: "messaged" },
  { _id: "d2", listing_id: "listing:102", attrs: { ...base, price: 2600, laundry: false }, outcome: "rejected" },
  { _id: "d3", listing_id: "listing:103", attrs: { ...base, price: 2750, floor: 5, elevator: true, walkup_floor: 0 }, outcome: "messaged" },
  { _id: "d4", listing_id: "listing:104", attrs: { ...base, price: 2750, floor: 5, elevator: false, walkup_floor: 5 }, outcome: "rejected" },
  { _id: "d5", listing_id: "listing:105", attrs: { ...base, price: 3100 }, outcome: "unopened" },
];

const laundry: Rule = { attr: "laundry", op: "==", value: true, then: "skip", support: [] };
const budget: Rule = { attr: "price", op: "<=", value: 2800, then: "skip", support: [] };
const wrong: Rule = { attr: "floor", op: "<=", value: 3, then: "skip", support: [] };

describe("satisfies", () => {
  it("handles every operator", () => {
    expect(satisfies({ attr: "price", op: "<=", value: 2800 }, decisions[0]!.attrs)).toBe(true);
    expect(satisfies({ attr: "floor", op: ">=", value: 5 }, decisions[2]!.attrs)).toBe(true);
    expect(satisfies({ attr: "laundry", op: "==", value: true }, decisions[1]!.attrs)).toBe(false);
    expect(satisfies({ attr: "train", op: "!=", value: "G" }, decisions[0]!.attrs)).toBe(true);
    expect(satisfies({ attr: "train", op: "in", value: ["L", "M"] }, decisions[0]!.attrs)).toBe(true);
    expect(satisfies({ attr: "train", op: "in", value: ["G"] }, decisions[0]!.attrs)).toBe(false);
  });
});

describe("checkRule", () => {
  it("accepts a rule consistent with every decision and lists what it explains", () => {
    const r = checkRule(laundry, decisions);
    expect(r.ok).toBe(true);
    expect(r.explained).toEqual(["d2"]);
    expect(r.contradictions).toEqual([]);
  });
  it("drops a rule contradicted by any messaged decision", () => {
    const r = checkRule(wrong, decisions);
    expect(r.ok).toBe(false);
    expect(r.contradictions).toEqual(["d3"]);
  });
  it("never contradicts a prefer rule", () => {
    const r = checkRule({ ...wrong, then: "prefer" }, decisions);
    expect(r.ok).toBe(true);
  });
});

describe("contrastive pairs", () => {
  it("finds pairs differing in exactly one attribute with different outcomes", () => {
    const pairs = findContrastivePairs(decisions);
    expect(pairs).toEqual(
      expect.arrayContaining([
        { attr: "laundry", a: "d1", b: "d2" },
        { attr: "elevator", a: "d3", b: "d4" },
        { attr: "price", a: "d1", b: "d5" },
      ]),
    );
    expect(pairs).toHaveLength(3);
  });
  it("a derived-attribute rule is supported by pairs on its source attribute", () => {
    const walkup: Rule = { attr: "walkup_floor", op: "<=", value: 3, then: "skip", support: [] };
    expect(pairsSupporting(walkup, decisions)).toEqual([{ attr: "elevator", a: "d3", b: "d4" }]);
    expect(checkRule(walkup, decisions).ok).toBe(true);
  });
  it("credits only pairs the rule predicts", () => {
    expect(pairsSupporting(laundry, decisions)).toHaveLength(1);
    expect(pairsSupporting(budget, decisions)).toHaveLength(1);
    expect(pairsSupporting({ ...budget, attr: "floor", op: "<=", value: 3 }, decisions)).toHaveLength(0);
  });
});

describe("thresholds", () => {
  it("computes tightest and loosest consistent budgets", () => {
    expect(thresholdRange("price", "<=", decisions)).toEqual({ tightest: 2750, loosest: 3099 });
  });
  it("loosens a proposed threshold to the loosest consistent value", () => {
    expect(loosenThreshold({ ...budget, value: 2700 }, decisions).value).toBe(3099);
  });
  it("returns null with no messaged anchor", () => {
    expect(thresholdRange("price", "<=", decisions.filter((d) => d.outcome !== "messaged"))).toBeNull();
  });
});

describe("checkRules", () => {
  it("keeps consistent explanatory rules, drops contradicted and vacuous ones, ranks by pairs", () => {
    const vacuous: Rule = { attr: "train", op: "==", value: "L", then: "skip", support: [] };
    const elevatorOrLow: Rule = { attr: "elevator", op: "==", value: true, then: "skip", support: [] };
    const out = checkRules([budget, laundry, wrong, vacuous, elevatorOrLow], decisions);
    const attrs = out.map((s) => s.rule.attr);
    expect(attrs).not.toContain("floor");
    expect(attrs).not.toContain("train");
    expect(attrs).toContain("laundry");
    expect(attrs).toContain("price");
    expect(out[0]!.pairs).toBeGreaterThanOrEqual(out[out.length - 1]!.pairs);
    const l = out.find((s) => s.rule.attr === "laundry")!;
    expect(l.rule.support).toEqual(expect.arrayContaining(["d1", "d2"]));
  });
});

describe("applying rules", () => {
  it("reports the skip rules a listing violates", () => {
    const rules = checkRules([budget, laundry], decisions).map((s) => s.rule);
    const violated = violatedRules(rules, { ...base, price: 3500, laundry: false });
    expect(violated.map((r) => r.attr).sort()).toEqual(["laundry", "price"]);
    expect(violatedRules(rules, { ...base, price: 2000 })).toEqual([]);
  });
  it("describes a rule for the palace card", () => {
    expect(describeRule(budget)).toBe("requires price <= 2800");
  });
});
