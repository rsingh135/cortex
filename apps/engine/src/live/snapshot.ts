import { Snapshot, type Condition } from "@cortex/schema";
import { ulid } from "ulid";
import { withoutEmbedding, type MemoryData } from "../db/memory-data.js";
export function snapshot(data: MemoryData, condition: Condition) {
  return Snapshot.parse({
    id: ulid(),
    type: "snapshot",
    day: data.day,
    ts: new Date().toISOString(),
    condition,
    payload: {
      beliefs: data.beliefStates
        .filter(
          (s) =>
            s.condition === condition &&
            s.status !== "tombstoned" &&
            s.status !== "forgotten",
        )
        .flatMap((s) => {
          const b = data.beliefs.find((b) => b._id === s.belief_id);
          return b
            ? [
                {
                  ...withoutEmbedding(b),
                  confidence: s.confidence,
                  status: s.status,
                },
              ]
            : [];
        }),
      captures: data.captureStates
        .filter((s) => s.condition === condition)
        .flatMap((s) => {
          const c = data.captures.find((c) => c._id === s.capture_id);
          if (!c) return [];
          const { page_text: _, ...safe } = c;
          return [
            {
              ...safe,
              alive_levels: s.alive_levels,
              ceiling: s.ceiling,
              clarity: s.clarity,
            },
          ];
        }),
      procedures: data.procedures.map(withoutEmbedding),
      edges: data.edges,
    },
  });
}
