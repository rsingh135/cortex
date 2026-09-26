"use client";
/** One bucketed set of threads in three draw calls: evidence, solid, dashed. */
import { Line } from "@react-three/drei";
import { THREAD_DASHED, THREAD_EVIDENCE, THREAD_SOLID } from "./palette";
import type { ThreadSegments } from "./threadSegments";

export interface ThreadLinesProps {
  segments: ThreadSegments;
  opacity: number;
  /** Line width multiplier; focused threads are drawn a little heavier. */
  weight: number;
}

export function ThreadLines({ segments, opacity, weight }: ThreadLinesProps) {
  return (
    <>
      {segments.evidence.length > 0 && <Line segments points={segments.evidence} color={THREAD_EVIDENCE} lineWidth={0.8 * weight} transparent opacity={opacity} depthWrite={false} />}
      {segments.solid.length > 0 && <Line segments points={segments.solid} color={THREAD_SOLID} lineWidth={1.4 * weight} transparent opacity={opacity} depthWrite={false} />}
      {segments.dashed.length > 0 && (
        <Line segments points={segments.dashed} color={THREAD_DASHED} lineWidth={1.2 * weight} dashed dashSize={0.12} gapSize={0.08} transparent opacity={opacity} depthWrite={false} />
      )}
    </>
  );
}
