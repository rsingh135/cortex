/**
 * Forgetting applied to the view model for an arbitrary day. All math comes from @cortex/schema;
 * this file only decides which recall days count and turns the results into view-model fields
 * and synthetic events. Used by the fixture generator (day 24) and the store's `setDay`.
 */
import { DEFAULT_PARAMS, aliveLevelsOn, ceilingOf, clarity, confidence, isForgotten, type Level, type Params, type WsEvent } from "@cortex/schema";
import { levelBytes, snapshotBytes } from "./bytes";
import type { PalaceBelief, PalaceCapture, PalaceSnapshot } from "./types";

export interface RecallState {
  recalls: number;
  lastRecallDay: number;
}

/** Recalls that have happened by `day`, anchored on the creation day when none have. */
export function recallStateOn(createdDay: number, recallDays: readonly number[], day: number): RecallState {
  const applied = recallDays.filter((d) => d > createdDay && d <= day);
  return { recalls: applied.length, lastRecallDay: applied.length ? Math.max(...applied) : createdDay };
}

export interface CaptureStateOnDay extends RecallState {
  aliveLevels: Level[];
  ceiling: Level | null;
  clarity: number;
}

export function captureStateOn(capture: Pick<PalaceCapture, "day" | "recallDays">, day: number, p: Params = DEFAULT_PARAMS): CaptureStateOnDay {
  if (capture.day > day) return { aliveLevels: [], ceiling: null, clarity: 0, recalls: 0, lastRecallDay: capture.day };
  const rs = recallStateOn(capture.day, capture.recallDays, day);
  const alive = aliveLevelsOn("cortex", day, rs.lastRecallDay, rs.recalls, p);
  const ceiling = ceilingOf(alive);
  return { aliveLevels: alive, ceiling, clarity: clarity("cortex", ceiling, day - rs.lastRecallDay, rs.recalls, p), ...rs };
}

export function isHumanSourced(belief: Pick<PalaceBelief, "source">): boolean {
  return belief.source === "voice" || belief.source === "manual";
}

export function beliefConfidenceOn(belief: Pick<PalaceBelief, "c0" | "createdDay" | "recallDays" | "source" | "pinned">, day: number, p: Params = DEFAULT_PARAMS): number {
  const rs = recallStateOn(belief.createdDay, belief.recallDays, day);
  return confidence("cortex", belief.c0, day - rs.lastRecallDay, rs.recalls, { humanSourced: isHumanSourced(belief), pinned: belief.pinned }, p);
}

export interface SweepResult {
  snapshot: PalaceSnapshot;
  /** Synthetic `level.deleted`, `belief.forgotten` and a closing `clock.advanced`, in that order. */
  events: WsEvent[];
  /** True when a placement-relevant membership changed (a belief appeared, vanished or was forgotten). */
  membershipChanged: boolean;
}

export interface SweepOptions {
  /** Regenerate a capture's texture when its ceiling changes (fixture placeholder). */
  texture?: (capture: PalaceCapture) => string | null;
  /** Event id + timestamp source, so tests can pin them. */
  eventId: () => string;
  now: () => string;
  params?: Params;
}

/** Move the whole snapshot to `day`, recomputing every capture and belief from the forgetting math. */
export function sweepSnapshot(snapshot: PalaceSnapshot, day: number, opts: SweepOptions): SweepResult {
  const p = opts.params ?? DEFAULT_PARAMS;
  const fromDay = snapshot.day;
  const events: WsEvent[] = [];
  const ts = opts.now();
  let levelsDeleted = 0;
  let bytesFreed = 0;
  let capturesForgotten = 0;

  const captures = snapshot.captures.map((c) => {
    const state = captureStateOn(c, day, p);
    const removed = c.aliveLevels.filter((lvl) => !state.aliveLevels.includes(lvl));
    if (removed.length > 0 && day >= fromDay) {
      const freed = removed.reduce((sum, lvl) => sum + levelBytes(lvl, c.l0Bytes), 0);
      levelsDeleted += removed.length;
      bytesFreed += freed;
      if (state.aliveLevels.length === 0) capturesForgotten += 1;
      events.push({
        id: opts.eventId(),
        day,
        ts,
        condition: "cortex",
        type: "level.deleted",
        payload: { capture_id: c.id, levels: removed, ceiling: state.ceiling, bytes_freed: freed },
      });
    }
    const ceilingChanged = state.ceiling !== c.ceiling;
    const textureUrl = ceilingChanged && opts.texture ? opts.texture({ ...c, ...state }) : c.textureUrl;
    return { ...c, ...state, textureUrl: state.ceiling === null ? null : textureUrl };
  });
  const captureById = new Map(captures.map((c) => [c.id, c]));

  let beliefsDecayed = 0;
  let beliefsForgotten = 0;
  let membershipChanged = false;
  const roomsDimmed = new Set<PalaceBelief["room"]>();
  const beliefs = snapshot.beliefs.map((b) => {
    const rs = recallStateOn(b.createdDay, b.recallDays, day);
    const conf = beliefConfidenceOn(b, day, p);
    if (conf < b.confidence) beliefsDecayed += 1;
    let status = b.status;
    if (status === "active" || status === "forgotten") {
      const aliveEvidence = b.evidence.filter((id) => (captureById.get(id)?.aliveLevels.length ?? 0) > 0).length;
      const forgotten = b.createdDay <= day && isForgotten(conf, aliveEvidence, p);
      status = forgotten ? "forgotten" : "active";
      if (status !== b.status) {
        membershipChanged = true;
        if (status === "forgotten") {
          beliefsForgotten += 1;
          roomsDimmed.add(b.room);
          events.push({ id: opts.eventId(), day, ts, condition: "cortex", type: "belief.forgotten", payload: { belief_id: b.id, room: b.room } });
        }
      }
    }
    if ((b.createdDay <= fromDay) !== (b.createdDay <= day)) membershipChanged = true;
    return { ...b, confidence: conf, recalls: rs.recalls, lastRecallDay: rs.lastRecallDay, status };
  });

  events.push({
    id: opts.eventId(),
    day,
    ts,
    condition: "cortex",
    type: "clock.advanced",
    payload: {
      from_day: fromDay,
      to_day: day,
      levels_deleted: levelsDeleted,
      bytes_freed: bytesFreed,
      captures_forgotten: capturesForgotten,
      beliefs_decayed: beliefsDecayed,
      beliefs_forgotten: beliefsForgotten,
      rooms_dimmed: [...roomsDimmed],
    },
  });

  const next: PalaceSnapshot = { ...snapshot, day, beliefs, captures, bytes: snapshotBytes(captures, day) };
  return { snapshot: next, events, membershipChanged };
}
