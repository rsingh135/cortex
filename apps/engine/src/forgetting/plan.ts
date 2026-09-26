/**
 * Pure planning for the forgetting sweep and for recalls. No I/O. All math from @cortex/schema.
 * docs/spec.md > Forgetting engine, > Parameters.
 */
import {
  DEFAULT_PARAMS,
  aliveLevelsOn,
  applyCaptureRecall,
  ceilingOf,
  clarity,
  confidence,
  isForgotten,
  type BeliefState,
  type CaptureState,
  type Condition,
  type Level,
  type Params,
} from "@cortex/schema";

export interface CaptureChange {
  capture_id: string;
  deleteLevels: Level[];
  next: CaptureState;
}

export interface BeliefChange {
  belief_id: string;
  next: BeliefState;
  forgotten: boolean;
}

export interface SweepPlan {
  condition: Condition;
  day: number;
  captures: CaptureChange[];
  beliefs: BeliefChange[];
  levels_deleted: number;
  captures_forgotten: number;
  beliefs_decayed: number;
  beliefs_forgotten: number;
}

/** Belief metadata the sweep needs beyond the state row. */
export interface BeliefMeta {
  belief_id: string;
  c0: number;
  humanSourced: boolean;
  pinned: boolean;
  /** Capture ids in evidence; used to decide "no alive evidence". */
  evidence: string[];
}

export function planSweep(
  condition: Condition,
  day: number,
  captureStates: readonly CaptureState[],
  beliefStates: readonly BeliefState[],
  beliefMeta: ReadonlyMap<string, BeliefMeta>,
  p: Params = DEFAULT_PARAMS,
): SweepPlan {
  const captures: CaptureChange[] = [];
  const aliveByCapture = new Map<string, number>();
  for (const s of captureStates) {
    const alive = aliveLevelsOn(condition, day, s.last_recall_day, s.recalls, p).filter((l) => s.alive_levels.includes(l));
    const deleteLevels = s.alive_levels.filter((l) => !alive.includes(l));
    const ceiling = ceilingOf(alive);
    const next: CaptureState = {
      ...s,
      alive_levels: alive,
      ceiling,
      clarity: clarity(condition, ceiling, day - s.last_recall_day, s.recalls, p),
    };
    aliveByCapture.set(s.capture_id, alive.length);
    if (deleteLevels.length || next.clarity !== s.clarity || next.ceiling !== s.ceiling) captures.push({ capture_id: s.capture_id, deleteLevels, next });
  }

  const beliefs: BeliefChange[] = [];
  for (const s of beliefStates) {
    if (s.status === "superseded" || s.status === "tombstoned" || s.status === "forgotten") continue;
    const meta = beliefMeta.get(s.belief_id);
    if (!meta) continue;
    const conf = confidence(condition, meta.c0, day - s.last_recall_day, s.recalls, { humanSourced: meta.humanSourced, pinned: meta.pinned }, p);
    const aliveEvidence = meta.evidence.reduce((n, id) => n + ((aliveByCapture.get(id) ?? 0) > 0 ? 1 : 0), 0);
    const forgotten = isForgotten(conf, aliveEvidence, p);
    const next: BeliefState = { ...s, confidence: conf, status: forgotten ? "forgotten" : s.status };
    if (forgotten || conf !== s.confidence) beliefs.push({ belief_id: s.belief_id, next, forgotten });
  }

  return {
    condition,
    day,
    captures,
    beliefs,
    levels_deleted: captures.reduce((n, c) => n + c.deleteLevels.length, 0),
    captures_forgotten: captures.filter((c) => c.next.ceiling === null && c.deleteLevels.length > 0).length,
    beliefs_decayed: beliefs.filter((b) => !b.forgotten).length,
    beliefs_forgotten: beliefs.filter((b) => b.forgotten).length,
  };
}

export interface RecallPlan {
  belief: BeliefState;
  captures: CaptureState[];
}

/**
 * Recall of a belief on `day`: the belief's clock resets and recalls increment; every evidence capture
 * (plus one hop of derived_from evidence, passed in by the caller) is recalled too, once per run.
 * In blur_by_age and keep_all the states come back unchanged apart from recomputed clarity.
 */
export function planRecall(
  condition: Condition,
  day: number,
  belief: BeliefState,
  beliefC0: number,
  cascade: readonly CaptureState[],
  alreadyRecalled: ReadonlySet<string>,
  p: Params = DEFAULT_PARAMS,
): RecallPlan {
  const nextBelief: BeliefState =
    condition === "cortex" ? { ...belief, recalls: belief.recalls + 1, last_recall_day: day, confidence: Math.max(belief.confidence, beliefC0) } : belief;
  const captures = cascade
    .filter((c) => !alreadyRecalled.has(c.capture_id) && c.ceiling !== null)
    .map((c) => {
      const r = applyCaptureRecall(condition, { recalls: c.recalls, lastRecallDay: c.last_recall_day, ceiling: c.ceiling }, day, p);
      return { ...c, recalls: r.recalls, last_recall_day: r.lastRecallDay, clarity: r.clarity };
    });
  return { belief: nextBelief, captures };
}
