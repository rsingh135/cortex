/**
 * Wall collision for the first-person walker. Walls are thin segments (see `geometry.ts`); the
 * player is a circle. Each wall acts as a capsule of radius wall-thickness/2 + player radius, and
 * the position is pushed out along the capsule normal. A few passes settle corners.
 */
import type { PalaceLayout } from "@/lib/types";
import { PLAYER_RADIUS, WALL_THICKNESS, buildWalls, collisionWalls, type Vec2, type WallSegment } from "./geometry";

export { buildWalls, collisionWalls, PLAYER_RADIUS, type WallSegment } from "./geometry";

const PASSES = 3;
const EPSILON = 1e-4;

/** The wall set the walker collides with, built from a layout. */
export function collisionSet(layout: PalaceLayout): WallSegment[] {
  return collisionWalls(buildWalls(layout));
}

/** Closest point on segment ab to p. */
export function closestPointOnSegment(a: Vec2, b: Vec2, p: Vec2): Vec2 {
  const abx = b[0] - a[0];
  const abz = b[1] - a[1];
  const len2 = abx * abx + abz * abz;
  if (len2 < EPSILON) return [a[0], a[1]];
  let t = ((p[0] - a[0]) * abx + (p[1] - a[1]) * abz) / len2;
  t = Math.max(0, Math.min(1, t));
  return [a[0] + abx * t, a[1] + abz * t];
}

/** Push `position` out of every wall it overlaps. Returns a new point. */
export function resolveCollision(walls: readonly WallSegment[], position: Vec2, radius = PLAYER_RADIUS): Vec2 {
  const minDist = radius + WALL_THICKNESS / 2;
  let x = position[0];
  let z = position[1];
  for (let pass = 0; pass < PASSES; pass++) {
    let moved = false;
    for (const w of walls) {
      const [cx, cz] = closestPointOnSegment(w.a, w.b, [x, z]);
      let nx = x - cx;
      let nz = z - cz;
      let dist = Math.hypot(nx, nz);
      if (dist >= minDist) continue;
      if (dist < EPSILON) {
        // Exactly on the wall line: push along the wall normal, toward the side we came from.
        const wx = w.b[0] - w.a[0];
        const wz = w.b[1] - w.a[1];
        const wl = Math.hypot(wx, wz) || 1;
        nx = -wz / wl;
        nz = wx / wl;
        dist = 1;
      } else {
        nx /= dist;
        nz /= dist;
      }
      x = cx + nx * minDist;
      z = cz + nz * minDist;
      moved = true;
    }
    if (!moved) break;
  }
  return [x, z];
}

/**
 * Move from `from` toward `to` and resolve against the walls. Steps are short (a few centimetres a
 * frame), so resolving only the end point is enough to keep the walker out of 22 cm walls.
 */
export function moveWithCollision(walls: readonly WallSegment[], from: Vec2, to: Vec2, radius = PLAYER_RADIUS): Vec2 {
  const resolved = resolveCollision(walls, to, radius);
  // If the resolved point jumped through a wall (rare corner case), stay put.
  const travel = Math.hypot(resolved[0] - from[0], resolved[1] - from[1]);
  const intended = Math.hypot(to[0] - from[0], to[1] - from[1]);
  if (travel > intended + radius) return from;
  return resolved;
}
