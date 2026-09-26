/**
 * Where a thread attaches to each kind of object, and how beliefs read visually. Pure.
 */
import type { PalaceBelief, Placement, Vec3 } from "@/lib/types";
import { BELIEF_SIZE, CASE_BASE_HEIGHT, CASE_SIZE, LOW_CONFIDENCE_SINK, MIN_BELIEF_OPACITY, PEDESTAL_HEIGHT, TABLE_HEIGHT } from "./palette";
import { clamp01 } from "./pulse";

/** World point a thread attaches to for a placement. */
export function anchorFor(p: Placement): Vec3 {
  const [x, y, z] = p.position;
  switch (p.kind) {
    case "belief":
      return [x, y + PEDESTAL_HEIGHT + BELIEF_SIZE, z];
    case "procedure":
      return [x, y + TABLE_HEIGHT + 0.05, z];
    case "archive":
      return [x, y + CASE_BASE_HEIGHT + CASE_SIZE / 2, z];
    case "painting":
      return [x, y, z];
  }
}

/** Gold trim: pinned, or told to us directly (voice or a manual palace edit). */
export function isGold(belief: Pick<PalaceBelief, "pinned" | "source">): boolean {
  return belief.pinned || belief.source === "voice" || belief.source === "manual";
}

/** Object opacity 0.35 -> 1 with confidence. */
export function beliefOpacity(confidence: number): number {
  return MIN_BELIEF_OPACITY + (1 - MIN_BELIEF_OPACITY) * clamp01(confidence);
}

/** Below 0.5 confidence the object sinks, reaching 10 cm at confidence 0. */
export function beliefSink(confidence: number): number {
  const c = clamp01(confidence);
  return c >= 0.5 ? 0 : LOW_CONFIDENCE_SINK * (1 - c / 0.5);
}
