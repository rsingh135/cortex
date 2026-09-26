import { BSON } from "mongodb";
import {
  CONDITIONS,
  AdvanceClockResponse,
  type Condition,
  type Room,
} from "@cortex/schema";
import { planSweep, type BeliefMeta } from "./plan.js";
import { withoutEmbedding, type MemoryData } from "../db/memory-data.js";

/** Evaluation mode: update ledgers; preserve canonical images for the other strategies. */
export function advanceMemory(
  data: MemoryData,
  toDay: number,
  conditions: readonly Condition[] = CONDITIONS,
) {
  if (toDay < data.day) throw new RangeError("Clock cannot move backwards");
  if (CONDITIONS.some((c) => !conditions.includes(c)))
    throw new RangeError(
      "Advance all conditions together while using the shared clock",
    );
  const from = data.day;
  const meta = new Map<string, BeliefMeta>(
    data.beliefs.map((b) => [
      b._id,
      {
        belief_id: b._id,
        c0: b.c0,
        humanSourced: b.source === "voice" || b.source === "manual",
        pinned: b.pinned,
        evidence: b.evidence,
      },
    ]),
  );
  const perCondition = Object.fromEntries(
    CONDITIONS.map((condition) => {
      const captures = data.captureStates.filter(
        (s) => s.condition === condition,
      );
      const beliefs = data.beliefStates.filter(
        (s) => s.condition === condition,
      );
      const plan = planSweep(condition, toDay, captures, beliefs, meta);
      let bytesFreed = 0;
      for (const change of plan.captures) {
        bytesFreed += data.levels
          .filter(
            (l) =>
              l.capture_id === change.capture_id &&
              change.deleteLevels.includes(l.level),
          )
          .reduce((n, l) => n + l.bytes, 0);
        Object.assign(
          captures.find((s) => s.capture_id === change.capture_id)!,
          change.next,
        );
      }
      const rooms = new Set<Room>();
      for (const change of plan.beliefs) {
        const state = beliefs.find((s) => s.belief_id === change.belief_id)!;
        const belief = data.beliefs.find((b) => b._id === change.belief_id)!;
        if (change.next.confidence < state.confidence) rooms.add(belief.room);
        Object.assign(state, change.next);
      }
      const imageBytes = captures.reduce(
        (total, state) =>
          total +
          data.levels
            .filter(
              (l) =>
                l.capture_id === state.capture_id &&
                state.alive_levels.includes(l.level),
            )
            .reduce((n, l) => n + l.bytes, 0),
        0,
      );
      const beliefBytes = beliefs
        .filter((s) => s.status === "active" || s.status === "cracked")
        .reduce((total, state) => {
          const belief = data.beliefs.find((b) => b._id === state.belief_id);
          return (
            total +
            (belief ? BSON.calculateObjectSize(withoutEmbedding(belief)) : 0)
          );
        }, 0);
      const previous = data.stats.find(
        (s) => s.condition === condition && s.day === toDay,
      );
      const stat = {
        _id: previous?._id ?? `${condition}:${toDay}`,
        condition,
        day: toDay,
        image_bytes: imageBytes,
        belief_bytes: beliefBytes,
        captures_alive: captures.filter((c) => c.ceiling !== null).length,
        captures_forgotten: captures.filter((c) => c.ceiling === null).length,
        beliefs_active: beliefs.filter(
          (b) => b.status === "active" || b.status === "cracked",
        ).length,
      };
      if (previous) Object.assign(previous, stat);
      else data.stats.push(stat);
      return [
        condition,
        {
          levels_deleted: plan.levels_deleted,
          bytes_freed: bytesFreed,
          captures_forgotten: plan.captures_forgotten,
          beliefs_decayed: plan.beliefs_decayed,
          beliefs_forgotten: plan.beliefs_forgotten,
          rooms_dimmed: [...rooms],
          image_bytes: imageBytes,
          belief_bytes: beliefBytes,
        },
      ];
    }),
  );
  data.day = toDay;
  return AdvanceClockResponse.parse({
    from_day: from,
    to_day: toDay,
    per_condition: perCondition,
  });
}

export interface Sweeper {
  advance(
    day: number,
    conditions?: Condition[],
  ): Promise<ReturnType<typeof advanceMemory>>;
}
export function createSweeper(
  store: import("../db/memory-store.js").MemoryStore,
): Sweeper {
  return {
    advance: (day, conditions) =>
      store.run(true, (data) => advanceMemory(data, day, conditions)),
  };
}
