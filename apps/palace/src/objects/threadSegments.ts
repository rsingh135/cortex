/**
 * Turns snapshot edges into threads between placed objects: evidence threads (belief -> painting),
 * solid derived_from / uses threads, and dashed threads for anything touching an inferred belief.
 * `bucketThreads` flattens them into the point lists drei `<Line segments>` wants, optionally only
 * those touching one focused object. Pure; cross-room threads are dropped so lines never cut
 * through walls.
 */
import type { PalaceLayout, PalaceSnapshot, Placement, Vec3 } from "@/lib/types";
import { anchorFor } from "./anchors";

export type ThreadBucket = "evidence" | "solid" | "dashed";

export interface Thread {
  from: string;
  to: string;
  bucket: ThreadBucket;
  a: Vec3;
  b: Vec3;
}

export interface ThreadSegments {
  evidence: Vec3[];
  solid: Vec3[];
  dashed: Vec3[];
}

export function buildThreads(snapshot: PalaceSnapshot, layout: PalaceLayout): Thread[] {
  const out: Thread[] = [];
  const inferred = new Set(snapshot.beliefs.filter((b) => b.inferred).map((b) => b.id));
  const seen = new Set<string>();

  const push = (from: Placement, to: Placement, bucket: ThreadBucket) => {
    if (from.room !== to.room) return;
    const key = `${from.id}>${to.id}`;
    if (seen.has(key)) return;
    seen.add(key);
    out.push({ from: from.id, to: to.id, bucket, a: anchorFor(from), b: anchorFor(to) });
  };

  for (const edge of snapshot.edges) {
    if (edge.type === "supersedes") continue;
    const from = layout.placements.get(edge.from);
    const to = layout.placements.get(edge.to);
    if (!from || !to) continue;
    const dashed = inferred.has(edge.from) || inferred.has(edge.to);
    push(from, to, dashed ? "dashed" : edge.type === "evidence" ? "evidence" : "solid");
  }

  for (const belief of snapshot.beliefs) {
    const from = layout.placements.get(belief.id);
    if (!from || from.kind !== "belief") continue;
    for (const captureId of belief.evidence) {
      const to = layout.placements.get(captureId);
      if (!to || to.kind !== "painting") continue;
      push(from, to, belief.inferred ? "dashed" : "evidence");
    }
  }

  return out;
}

/** Flat point pairs per bucket. With `focusId`, only the threads touching that object. */
export function bucketThreads(threads: readonly Thread[], focusId: string | null = null): ThreadSegments {
  const out: ThreadSegments = { evidence: [], solid: [], dashed: [] };
  for (const t of threads) {
    if (focusId !== null && t.from !== focusId && t.to !== focusId) continue;
    out[t.bucket].push(t.a, t.b);
  }
  return out;
}

/** Every thread, bucketed. */
export function buildThreadSegments(snapshot: PalaceSnapshot, layout: PalaceLayout): ThreadSegments {
  return bucketThreads(buildThreads(snapshot, layout));
}
