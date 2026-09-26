/**
 * Rule DSL for the workflow learner, plus the code checker that tests every proposed rule
 * against every decision. Rules are hypotheses; the checker decides which survive.
 */
import { z } from "zod";
import { LISTING_ATTRS, ListingAttr, RuleOp, RuleOutcome, type DecisionOutcome } from "./enums.js";

export const RuleValue = z.union([z.number(), z.string(), z.boolean(), z.array(z.string())]);
export type RuleValue = z.infer<typeof RuleValue>;

/**
 * A rule states a condition Maya requires of a listing: `attr op value`.
 * `then: "skip"`: listings that violate the condition are skipped (hard requirement).
 * `then: "prefer"`: soft ranking hint; never contradicted, never skips.
 */
export const Rule = z.object({
  attr: ListingAttr,
  op: RuleOp,
  value: RuleValue,
  then: RuleOutcome,
  /** Decision ids that support this rule. Filled by the checker. */
  support: z.array(z.string()).default([]),
});
export type Rule = z.infer<typeof Rule>;

export interface DecisionLike {
  _id: string;
  listing_id: string;
  attrs: Record<ListingAttr, number | string | boolean>;
  outcome: DecisionOutcome;
}

/** Does the listing satisfy the rule's condition? */
export function satisfies(rule: Pick<Rule, "attr" | "op" | "value">, attrs: DecisionLike["attrs"]): boolean {
  const v = attrs[rule.attr];
  switch (rule.op) {
    case "<=":
      return typeof v === "number" && typeof rule.value === "number" && v <= rule.value;
    case ">=":
      return typeof v === "number" && typeof rule.value === "number" && v >= rule.value;
    case "==":
      return v === rule.value;
    case "!=":
      return v !== rule.value;
    case "in":
      return Array.isArray(rule.value) && typeof v === "string" && rule.value.includes(v);
  }
}

export interface RuleCheck {
  ok: boolean;
  /** Decisions that violate the rule yet were messaged. Any one of these kills a `skip` rule. */
  contradictions: string[];
  /** Decisions the rule explains: violated and not messaged (skip), or satisfied and messaged (prefer). */
  explained: string[];
  /** Decisions the rule says nothing about. */
  neutral: string[];
}

/** Test a rule against every decision. A `skip` rule contradicted by any decision is dropped. */
export function checkRule(rule: Rule, decisions: readonly DecisionLike[]): RuleCheck {
  const contradictions: string[] = [];
  const explained: string[] = [];
  const neutral: string[] = [];
  for (const d of decisions) {
    const sat = satisfies(rule, d.attrs);
    if (rule.then === "skip") {
      if (!sat && d.outcome === "messaged") contradictions.push(d._id);
      else if (!sat) explained.push(d._id);
      else neutral.push(d._id);
    } else {
      if (sat && d.outcome === "messaged") explained.push(d._id);
      else neutral.push(d._id);
    }
  }
  return { ok: contradictions.length === 0, contradictions, explained, neutral };
}

/** Derived attributes and the raw attributes they are computed from. A derived difference is not a second difference. */
export const DERIVED_ATTRS: Partial<Record<ListingAttr, readonly ListingAttr[]>> = {
  walkup_floor: ["floor", "elevator"],
};

/** Does a pair differing on `pairAttr` bear on a rule over `ruleAttr`? */
export function attrBearsOn(ruleAttr: ListingAttr, pairAttr: ListingAttr): boolean {
  return ruleAttr === pairAttr || (DERIVED_ATTRS[ruleAttr]?.includes(pairAttr) ?? false);
}

/** Raw attribute on which two decisions differ, if they differ on exactly one (derived attrs follow their sources). */
export function singleDifference(a: DecisionLike, b: DecisionLike): ListingAttr | null {
  const raw = LISTING_ATTRS.filter((attr) => !(attr in DERIVED_ATTRS) && a.attrs[attr] !== b.attrs[attr]);
  if (raw.length !== 1) return null;
  return raw[0]!;
}

export interface ContrastivePair {
  attr: ListingAttr;
  a: string;
  b: string;
}

/** Pairs of decisions identical except for one attribute, with different outcomes. */
export function findContrastivePairs(decisions: readonly DecisionLike[]): ContrastivePair[] {
  const pairs: ContrastivePair[] = [];
  for (let i = 0; i < decisions.length; i++) {
    for (let j = i + 1; j < decisions.length; j++) {
      const a = decisions[i]!;
      const b = decisions[j]!;
      if (a.outcome === b.outcome) continue;
      const attr = singleDifference(a, b);
      if (attr) pairs.push({ attr, a: a._id, b: b._id });
    }
  }
  return pairs;
}

/** Contrastive pairs whose differing attribute is the rule's and whose outcomes the rule predicts. */
export function pairsSupporting(rule: Rule, decisions: readonly DecisionLike[]): ContrastivePair[] {
  const byId = new Map(decisions.map((d) => [d._id, d]));
  return findContrastivePairs(decisions).filter((pair) => {
    if (!attrBearsOn(rule.attr, pair.attr)) return false;
    const a = byId.get(pair.a)!;
    const b = byId.get(pair.b)!;
    const satA = satisfies(rule, a.attrs);
    const satB = satisfies(rule, b.attrs);
    if (satA === satB) return false;
    const violator = satA ? b : a;
    return violator.outcome !== "messaged";
  });
}

export interface ThresholdRange {
  /** Tightest consistent threshold: the extreme value among messaged listings. */
  tightest: number;
  /** Loosest consistent threshold: just inside the nearest rejected value beyond the messaged ones. */
  loosest: number;
}

/**
 * For a numeric `<=` or `>=` rule, the range of thresholds consistent with every decision.
 * `<=`: tightest = max messaged value; loosest = (min rejected value above tightest) - 1, or tightest if none.
 * `>=`: mirror image.
 * Returns null when there are no messaged decisions to anchor on.
 */
export function thresholdRange(
  attr: ListingAttr,
  op: "<=" | ">=",
  decisions: readonly DecisionLike[],
): ThresholdRange | null {
  const messaged = decisions.filter((d) => d.outcome === "messaged").map((d) => d.attrs[attr]).filter(isNum);
  const notMessaged = decisions.filter((d) => d.outcome !== "messaged").map((d) => d.attrs[attr]).filter(isNum);
  if (messaged.length === 0) return null;
  if (op === "<=") {
    const tightest = Math.max(...messaged);
    const above = notMessaged.filter((v) => v > tightest);
    const loosest = above.length ? Math.min(...above) - 1 : tightest;
    return { tightest, loosest };
  }
  const tightest = Math.min(...messaged);
  const below = notMessaged.filter((v) => v < tightest);
  const loosest = below.length ? Math.max(...below) + 1 : tightest;
  return { tightest, loosest };
}

/**
 * Clamp a proposed numeric threshold into the consistent range, choosing the loosest value.
 * Non-numeric rules are returned unchanged.
 */
export function loosenThreshold(rule: Rule, decisions: readonly DecisionLike[]): Rule {
  if ((rule.op !== "<=" && rule.op !== ">=") || typeof rule.value !== "number") return rule;
  const range = thresholdRange(rule.attr, rule.op, decisions);
  if (!range) return rule;
  return { ...rule, value: range.loosest };
}

export interface ScoredRule {
  rule: Rule;
  explained: number;
  pairs: number;
}

/**
 * Full learner check: loosen thresholds, drop contradicted `skip` rules, drop rules explaining nothing,
 * attach support, and count contrastive pairs.
 */
export function checkRules(proposed: readonly Rule[], decisions: readonly DecisionLike[]): ScoredRule[] {
  const out: ScoredRule[] = [];
  for (const raw of proposed) {
    const rule = loosenThreshold(raw, decisions);
    const check = checkRule(rule, decisions);
    if (!check.ok) continue;
    if (check.explained.length === 0) continue;
    const pairs = pairsSupporting(rule, decisions);
    out.push({
      rule: { ...rule, support: [...check.explained, ...pairs.flatMap((p) => [p.a, p.b])].filter(unique) },
      explained: check.explained.length,
      pairs: pairs.length,
    });
  }
  return out.sort((a, b) => b.pairs - a.pairs || b.explained - a.explained);
}

/** Apply surviving rules to a listing: which `skip` rules does it violate? */
export function violatedRules(rules: readonly Rule[], attrs: DecisionLike["attrs"]): Rule[] {
  return rules.filter((r) => r.then === "skip" && !satisfies(r, attrs));
}

export function describeRule(rule: Pick<Rule, "attr" | "op" | "value" | "then">): string {
  const v = Array.isArray(rule.value) ? `{${rule.value.join(", ")}}` : String(rule.value);
  return `${rule.then === "skip" ? "requires" : "prefers"} ${rule.attr} ${rule.op} ${v}`;
}

function isNum(v: unknown): v is number {
  return typeof v === "number" && Number.isFinite(v);
}

function unique<T>(v: T, i: number, arr: readonly T[]): boolean {
  return arr.indexOf(v) === i;
}
