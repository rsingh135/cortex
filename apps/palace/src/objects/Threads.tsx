"use client";
/**
 * The threads between objects. Every thread is drawn faintly so a busy room stays readable; the
 * threads touching the hovered (else selected) object are drawn bright on top, which is how a
 * visitor asks "what does this rest on?". At most six draw calls.
 */
import { useMemo } from "react";
import { useHoveredId, useLayout, useSelectedId, useSnapshot } from "@/lib/store";
import { ThreadLines } from "./ThreadLines";
import { bucketThreads, buildThreads } from "./threadSegments";

const REST_OPACITY = 0.12;
const FOCUS_OPACITY = 0.9;

export function Threads() {
  const snapshot = useSnapshot();
  const layout = useLayout();
  const hovered = useHoveredId();
  const selected = useSelectedId();
  const focusId = hovered ?? selected;
  const threads = useMemo(() => buildThreads(snapshot, layout), [snapshot, layout]);
  const rest = useMemo(() => bucketThreads(threads), [threads]);
  const focused = useMemo(() => (focusId ? bucketThreads(threads, focusId) : null), [threads, focusId]);

  return (
    <group name="threads">
      <ThreadLines segments={rest} opacity={REST_OPACITY} weight={1} />
      {focused && <ThreadLines segments={focused} opacity={FOCUS_OPACITY} weight={1.5} />}
    </group>
  );
}
