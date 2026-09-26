/**
 * Forgetting math. Single source of truth for the engine, the simulator, and the palace.
 * Mirrors the "Parameters" section of docs/spec.md. Tune via tools/simulate.ts, not here.
 */
import { LEVELS, type Condition, type Level } from "./enums.js";

export interface Params {
  /** Days each level lasts since last recall, before any recall doubling. */
  levelBaseDays: Record<Level, number>;
  /** Clarity value of a memory whose ceiling is this level. */
  levelValue: Record<Level, number>;
  /** Cap on the recall multiplier min(2^r, cap). */
  recallCap: number;
  /** Clarity decay rate per simulated day at r = 0. */
  lambdaClarity: number;
  /** Belief confidence decay rate per simulated day at r = 0. */
  lambdaBelief: number;
  /** Human-sourced beliefs (voice, manual) decay at this fraction of the rate. */
  humanDecayFactor: number;
  /** Reinforcement: c <- c + gain * (1 - c). */
  reinforceGain: number;
  /** Belief forgotten when confidence < this and no alive evidence. */
  forgetThreshold: number;
  /** Initial confidences by source. */
  c0: {
    screenEvent: number;
    voice: number;
    manual: number;
    pinned: number;
    /** Learner preference: base + perExplained * explained + perPair * pairs, capped. */
    learnerBase: number;
    learnerPerExplained: number;
    learnerPerPair: number;
    learnerCap: number;
  };
}

export const DEFAULT_PARAMS: Params = {
  levelBaseDays: { L0: 2, L1: 5, L2: 10, L3: 20 },
  levelValue: { L0: 1.0, L1: 0.75, L2: 0.5, L3: 0.25 },
  recallCap: 8,
  lambdaClarity: Math.LN2 / 4,
  lambdaBelief: Math.LN2 / 20,
  humanDecayFactor: 0.25,
  reinforceGain: 0.3,
  forgetThreshold: 0.1,
  c0: {
    screenEvent: 0.3,
    voice: 0.9,
    manual: 0.9,
    pinned: 1.0,
    learnerBase: 0.5,
    learnerPerExplained: 0.1,
    learnerPerPair: 0.1,
    learnerCap: 0.95,
  },
};

/** min(2^r, cap). */
export function recallMultiplier(recalls: number, p: Params = DEFAULT_PARAMS): number {
  return Math.min(Math.pow(2, Math.max(0, recalls)), p.recallCap);
}

/**
 * Recall count a condition actually applies.
 * cortex: real recalls. blur_by_age: recalls ignored. keep_all: irrelevant (nothing expires).
 */
export function effectiveRecalls(condition: Condition, recalls: number): number {
  return condition === "cortex" ? recalls : 0;
}

/** Days a level lasts after the last recall. */
export function lifetimeDays(level: Level, recalls: number, p: Params = DEFAULT_PARAMS): number {
  return p.levelBaseDays[level] * recallMultiplier(recalls, p);
}

/** Simulated day on which a level expires (deleted when clock.day >= expiresDay). */
export function expiresDay(level: Level, lastRecallDay: number, recalls: number, p: Params = DEFAULT_PARAMS): number {
  return lastRecallDay + lifetimeDays(level, recalls, p);
}

/** Levels still alive on `day` for a capture last recalled on `lastRecallDay` with `recalls` recalls. */
export function aliveLevelsOn(
  condition: Condition,
  day: number,
  lastRecallDay: number,
  recalls: number,
  p: Params = DEFAULT_PARAMS,
): Level[] {
  if (condition === "keep_all") return [...LEVELS];
  const r = effectiveRecalls(condition, recalls);
  return LEVELS.filter((lvl) => day < expiresDay(lvl, lastRecallDay, r, p));
}

/** Sharpest alive level, or null when everything is gone. */
export function ceilingOf(alive: readonly Level[]): Level | null {
  for (const lvl of LEVELS) if (alive.includes(lvl)) return lvl;
  return null;
}

/**
 * Clarity right now: value(ceiling) * exp(-lambda_c * dd / mult).
 * keep_all is always 1. blur_by_age uses r = 0 and never restores.
 */
export function clarity(
  condition: Condition,
  ceiling: Level | null,
  daysSinceRecall: number,
  recalls: number,
  p: Params = DEFAULT_PARAMS,
): number {
  if (ceiling === null) return 0;
  if (condition === "keep_all") return 1;
  const r = effectiveRecalls(condition, recalls);
  const dd = Math.max(0, daysSinceRecall);
  return p.levelValue[ceiling] * Math.exp((-p.lambdaClarity * dd) / recallMultiplier(r, p));
}

/**
 * Which stored level to hand the agent at a given clarity:
 * the sharpest alive level whose value <= clarity, else the lowest alive level.
 */
export function servedLevel(alive: readonly Level[], clarityNow: number, p: Params = DEFAULT_PARAMS): Level | null {
  if (alive.length === 0) return null;
  for (const lvl of LEVELS) {
    if (alive.includes(lvl) && p.levelValue[lvl] <= clarityNow + 1e-9) return lvl;
  }
  return [...LEVELS].reverse().find((lvl) => alive.includes(lvl)) ?? null;
}

/** Belief confidence after `daysSinceRecall` days. */
export function confidence(
  condition: Condition,
  c0: number,
  daysSinceRecall: number,
  recalls: number,
  opts: { humanSourced?: boolean; pinned?: boolean } = {},
  p: Params = DEFAULT_PARAMS,
): number {
  if (opts.pinned || condition === "keep_all") return c0;
  const r = effectiveRecalls(condition, recalls);
  const dd = Math.max(0, daysSinceRecall);
  const lambda = p.lambdaBelief * (opts.humanSourced ? p.humanDecayFactor : 1);
  return c0 * Math.exp((-lambda * dd) / recallMultiplier(r, p));
}

/** Reinforcement on a matching sighting. */
export function reinforce(c: number, p: Params = DEFAULT_PARAMS): number {
  return Math.min(1, c + p.reinforceGain * (1 - c));
}

/** Learner preference starting confidence. */
export function learnerConfidence(explained: number, contrastivePairs: number, p: Params = DEFAULT_PARAMS): number {
  const c = p.c0.learnerBase + p.c0.learnerPerExplained * explained + p.c0.learnerPerPair * contrastivePairs;
  return Math.min(p.c0.learnerCap, c);
}

/** A belief is forgotten when confidence is below threshold and no evidence level survives. */
export function isForgotten(conf: number, aliveEvidenceCount: number, p: Params = DEFAULT_PARAMS): boolean {
  return conf < p.forgetThreshold && aliveEvidenceCount === 0;
}

/**
 * Apply a recall on `day` to capture state. Returns new (recalls, lastRecallDay, clarity).
 * Clarity snaps to the ceiling value; the erosion clock resets; lifetimes double via recalls + 1.
 * blur_by_age and keep_all ignore recalls entirely (state unchanged apart from bookkeeping).
 */
export function applyCaptureRecall(
  condition: Condition,
  state: { recalls: number; lastRecallDay: number; ceiling: Level | null },
  day: number,
  p: Params = DEFAULT_PARAMS,
): { recalls: number; lastRecallDay: number; clarity: number } {
  if (condition !== "cortex") {
    return {
      recalls: state.recalls,
      lastRecallDay: state.lastRecallDay,
      clarity: clarity(condition, state.ceiling, day - state.lastRecallDay, state.recalls, p),
    };
  }
  return {
    recalls: state.recalls + 1,
    lastRecallDay: day,
    clarity: state.ceiling ? p.levelValue[state.ceiling] : 0,
  };
}

/** Human-readable parameters table for docs and the simulator. */
export function describeParams(p: Params = DEFAULT_PARAMS): string[] {
  const rows: string[] = [];
  for (const lvl of LEVELS) {
    rows.push(`${lvl}: base ${p.levelBaseDays[lvl]}d, value ${p.levelValue[lvl]}`);
  }
  rows.push(`recall multiplier: min(2^r, ${p.recallCap})`);
  rows.push(`lambda_clarity = ln2/${(Math.LN2 / p.lambdaClarity).toFixed(0)} (half-life ${(Math.LN2 / p.lambdaClarity).toFixed(1)}d)`);
  rows.push(`lambda_belief = ln2/${(Math.LN2 / p.lambdaBelief).toFixed(0)} (half-life ${(Math.LN2 / p.lambdaBelief).toFixed(1)}d)`);
  rows.push(`human-sourced decay factor: ${p.humanDecayFactor}`);
  rows.push(`reinforce gain: ${p.reinforceGain}; forget threshold: ${p.forgetThreshold}`);
  rows.push(
    `c0: screen event ${p.c0.screenEvent}, voice ${p.c0.voice}, manual ${p.c0.manual}, pinned ${p.c0.pinned}, learner ${p.c0.learnerBase} + ${p.c0.learnerPerExplained}/explained + ${p.c0.learnerPerPair}/pair cap ${p.c0.learnerCap}`,
  );
  return rows;
}
