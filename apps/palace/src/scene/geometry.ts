/**
 * Pure architectural geometry derived from a `PalaceLayout`: the atrium polygon, doorways, wall
 * segments (also the collision set) and camera poses. No three, no React: unit-testable and shared
 * by the meshes, the collision solver and the door flights so what you see is what blocks you.
 */
import {
  ATRIUM_SIDES,
  DOOR_HEIGHT,
  DOOR_WIDTH,
  EYE_HEIGHT,
  WALL_HEIGHT,
  WALL_THICKNESS,
  layoutExtent,
  roomAngle,
  roomCorners,
  roomDirection,
  roomFront,
  roomLocalToWorld,
  atriumPolygon,
} from "@/lib/layout";
import type { PalaceLayout, PalaceRoom, RoomLayout, Vec3 } from "@/lib/types";

export type Vec2 = [number, number];

export { ATRIUM_SIDES, WALL_THICKNESS, atriumPolygon };
export const ATRIUM_HEIGHT = 6;
export const SKYLIGHT_RADIUS = 6.5;
export const SKYLIGHT_CURB_HEIGHT = 0.5;
/** Player body radius for wall collision, in meters. */
export const PLAYER_RADIUS = 0.35;
/** Segments whose base is above this height are lintels and never block the player. */
export const PLAYER_HEIGHT = 1.9;

export interface WallSegment {
  a: Vec2;
  b: Vec2;
  /** Bottom of the wall (0 for a floor-standing wall, DOOR_HEIGHT for a lintel). */
  base: number;
  /** Top of the wall. */
  top: number;
  owner: PalaceRoom | "atrium";
  /** Plaster everywhere except the two doorway reveals, which are wood so every opening reads as a framed door. */
  finish: WallFinish;
}

export type WallFinish = "plaster" | "wood";

export interface Doorway {
  room: PalaceRoom;
  /** Centre of the opening in the atrium wall (radius 9). */
  outer: Vec3;
  /** Centre of the opening in the room's own door wall. */
  inner: Vec3;
  /** Unit direction from the atrium out through the door. */
  direction: Vec2;
  /** Unit vector along the door wall. */
  along: Vec2;
  /** Distance from `outer` to `inner`. */
  length: number;
}

export interface CameraPose {
  position: Vec3;
  /** World point the camera looks at. */
  target: Vec3;
}

/** One doorway per room and the archive. */
export function doorways(layout: PalaceLayout): Doorway[] {
  return [...layout.rooms, layout.archive].map((room) => {
    const [dx, dz] = roomDirection(room.room);
    const inner = roomFront(room);
    const outer = room.door;
    return {
      room: room.room,
      outer,
      inner,
      direction: [dx, dz],
      along: [-dz, dx],
      length: Math.hypot(inner[0] - outer[0], inner[2] - outer[2]),
    };
  });
}

/** Which atrium face (index into `atriumPolygon`) a room's door sits in. */
function faceIndexFor(room: PalaceRoom): number {
  const step = (Math.PI * 2) / ATRIUM_SIDES;
  return Math.round(roomAngle(room) / step) % ATRIUM_SIDES;
}

/** Every wall of the palace, including lintels over doors. Rooms are open to the sky. */
export function buildWalls(layout: PalaceLayout): WallSegment[] {
  const walls: WallSegment[] = [];
  const ways = doorways(layout);
  const doorByFace = new Map<number, Doorway>();
  for (const d of ways) doorByFace.set(faceIndexFor(d.room), d);

  const polygon = atriumPolygon(layout.atriumRadius);
  for (let k = 0; k < polygon.length; k++) {
    const a = polygon[k];
    const b = polygon[(k + 1) % polygon.length];
    const door = doorByFace.get(k);
    if (!door) {
      walls.push({ a, b, base: 0, top: ATRIUM_HEIGHT, owner: "atrium", finish: "plaster" });
      continue;
    }
    walls.push(...splitAtGap(a, b, [door.outer[0], door.outer[2]], DOOR_WIDTH, ATRIUM_HEIGHT, "atrium"));
  }

  for (const d of ways) {
    const half = DOOR_WIDTH / 2 + WALL_THICKNESS / 2;
    for (const side of [-1, 1]) {
      const ox = d.along[0] * half * side;
      const oz = d.along[1] * half * side;
      walls.push({ a: [d.outer[0] + ox, d.outer[2] + oz], b: [d.inner[0] + ox, d.inner[2] + oz], base: 0, top: WALL_HEIGHT, owner: d.room, finish: "wood" });
    }
  }

  for (const room of [...layout.rooms, layout.archive]) {
    const [backLeft, backRight, frontRight, frontLeft] = roomCorners(room);
    const front = roomFront(room);
    walls.push({ a: backLeft, b: backRight, base: 0, top: WALL_HEIGHT, owner: room.room, finish: "plaster" });
    walls.push({ a: backRight, b: frontRight, base: 0, top: WALL_HEIGHT, owner: room.room, finish: "plaster" });
    walls.push({ a: frontLeft, b: backLeft, base: 0, top: WALL_HEIGHT, owner: room.room, finish: "plaster" });
    walls.push(...splitAtGap(frontRight, frontLeft, [front[0], front[2]], DOOR_WIDTH, WALL_HEIGHT, room.room));
  }
  return walls;
}

/** The walls that can block a walking player. */
export function collisionWalls(walls: readonly WallSegment[]): WallSegment[] {
  return walls.filter((w) => w.base < PLAYER_HEIGHT);
}

/** Split a wall around a door: two floor-standing pieces and a lintel over the gap. */
function splitAtGap(a: Vec2, b: Vec2, centre: Vec2, gap: number, top: number, owner: WallSegment["owner"]): WallSegment[] {
  const len = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1;
  const ux = (b[0] - a[0]) / len;
  const uz = (b[1] - a[1]) / len;
  const half = gap / 2;
  const left: Vec2 = [centre[0] - ux * half, centre[1] - uz * half];
  const right: Vec2 = [centre[0] + ux * half, centre[1] + uz * half];
  return [
    { a, b: left, base: 0, top, owner, finish: "plaster" },
    { a: right, b, base: 0, top, owner, finish: "plaster" },
    { a: left, b: right, base: DOOR_HEIGHT, top, owner, finish: "plaster" },
  ];
}

/** Box transform for rendering a segment: midpoint, length (grown to close corners) and yaw. */
export function segmentTransform(w: WallSegment): { center: Vec3; length: number; height: number; rotationY: number } {
  const dx = w.b[0] - w.a[0];
  const dz = w.b[1] - w.a[1];
  return {
    center: [(w.a[0] + w.b[0]) / 2, (w.base + w.top) / 2, (w.a[1] + w.b[1]) / 2],
    length: Math.hypot(dx, dz) + WALL_THICKNESS,
    height: w.top - w.base,
    rotationY: Math.atan2(-dz, dx),
  };
}

/** Standing just inside a room's door, looking at its centre. */
export function roomEntryPose(room: RoomLayout): CameraPose {
  const inset = Math.min(1.8, room.size[1] / 4);
  const position = roomLocalToWorld(room, [0, EYE_HEIGHT, room.size[1] / 2 - inset]);
  return { position, target: [room.center[0], EYE_HEIGHT - 0.25, room.center[2]] };
}

/** Standing just inside the atrium after leaving through `doorway`, looking at the atrium centre. */
export function atriumEntryPose(doorway: Doorway): CameraPose {
  const inset = 1.8;
  const position: Vec3 = [doorway.outer[0] - doorway.direction[0] * inset, EYE_HEIGHT, doorway.outer[2] - doorway.direction[1] * inset];
  return { position, target: [0, EYE_HEIGHT - 0.25, 0] };
}

/** Bird's-eye pose for orbit mode: the whole palace in frame. */
export function overviewPose(layout: PalaceLayout): CameraPose {
  const e = layoutExtent(layout);
  return { position: [e * 0.9, e * 1.15, e * 0.9], target: [0, 0, 0] };
}

/**
 * The doorway the player is facing: within `maxDistance` of either opening and within `maxAngle`
 * radians of the forward direction. `forward` is the horizontal look direction.
 */
export function doorwayInFront(ways: readonly Doorway[], position: Vec3, forward: Vec2, maxDistance = 6, maxAngle = Math.PI / 5): Doorway | null {
  let best: Doorway | null = null;
  let bestScore = Infinity;
  const flen = Math.hypot(forward[0], forward[1]) || 1;
  const fx = forward[0] / flen;
  const fz = forward[1] / flen;
  for (const d of ways) {
    for (const opening of [d.outer, d.inner]) {
      const vx = opening[0] - position[0];
      const vz = opening[2] - position[2];
      const dist = Math.hypot(vx, vz);
      if (dist > maxDistance || dist < 1e-3) continue;
      const cos = (vx * fx + vz * fz) / dist;
      const angle = Math.acos(Math.max(-1, Math.min(1, cos)));
      if (angle > maxAngle) continue;
      const score = dist + angle * 2;
      if (score < bestScore) {
        bestScore = score;
        best = d;
      }
    }
  }
  return best;
}
