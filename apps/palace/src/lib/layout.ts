/**
 * Deterministic palace layout. Pure: the same snapshot always yields the same layout, and every
 * slot index comes from an FNV-1a hash of the object's `_id`, so objects stay put across renders,
 * reconnects and membership changes elsewhere in the room.
 *
 * Units are meters, y up. Room-local coordinates: +z points at the atrium (door wall at
 * local z = +depth/2), the back wall is at local z = -depth/2, x runs along the door wall.
 */
import { ROOMS, type Room } from "@cortex/schema";
import { fnv1a } from "./hash";
import type { PalaceBelief, PalaceCapture, PalaceSnapshot } from "./types";
import { isShownInRoom } from "./types";

export type Vec3 = [number, number, number];
export type PalaceRoom = Room | "Archive";
export type PlacementKind = "belief" | "procedure" | "painting" | "archive";

export interface RoomLayout {
  room: PalaceRoom;
  center: Vec3;
  /** [width, depth]; width runs along the door wall. */
  size: [number, number];
  rotationY: number;
  /** Opening in the atrium wall this room is reached through. */
  door: Vec3;
}

export interface Placement {
  id: string;
  kind: PlacementKind;
  room: PalaceRoom;
  position: Vec3;
  rotationY: number;
}

export interface PalaceLayout {
  atriumRadius: number;
  rooms: RoomLayout[];
  archive: RoomLayout;
  placements: Map<string, Placement>;
}

export const ATRIUM_RADIUS = 9;
export const DOORWAY_LENGTH = 1.5;
export const WALL_HEIGHT = 4;
/** Walls are boxes centred on the footprint line, so a room's inner face is half this inside the footprint. */
export const WALL_THICKNESS = 0.22;
export const EYE_HEIGHT = 1.7;
export const DOOR_WIDTH = 1.6;
export const DOOR_HEIGHT = 2.6;
export const ARCHIVE_ANGLE_DEG = 330;
export const ARCHIVE_SIZE = 6;
export const ARCHIVE_MIN_DISTANCE = 13;
/** Minimum distance between any two placements in one room; tests enforce it. */
export const MIN_PLACEMENT_GAP = 0.4;
/** The atrium floor is a regular 12-gon whose faces are centred on the door angles (every 30 degrees). */
export const ATRIUM_SIDES = 12;

const PEDESTAL_MARGIN = 1.5;
const PEDESTAL_BACK_MARGIN = 2.2;
const PEDESTAL_FRONT_MARGIN = 2.0;
const TABLE_OFFSET_FROM_BACK_WALL = 0.9;
const TABLE_SPACING = 2.4;
/** Centre-to-centre along a wall; frames are 1.08 m wide (objects/palette PAINTING_WIDTH + borders). */
const PAINTING_SPACING = 1.2;
const PAINTING_WALL_MARGIN = 0.9;
/** Two rows at eye height; a third row near the 4 m ceiling read as smudges. */
const PAINTING_ROWS_Y = [1.4, 2.3];
/** Frame centre off the footprint line: past the wall's inner face, plus half a frame depth and a small gap. */
const PAINTING_WALL_OFFSET = WALL_THICKNESS / 2 + 0.05;
const ARCHIVE_MARGIN = 1.0;
const ROOM_CLEARANCE = 0.5;

const TWO_PI = Math.PI * 2;

export function roomAngle(room: PalaceRoom): number {
  if (room === "Archive") return (ARCHIVE_ANGLE_DEG * Math.PI) / 180;
  const index = ROOMS.indexOf(room);
  return (index * Math.PI) / 3;
}

/** Unit direction from the origin to the room, in the xz plane. */
export function roomDirection(room: PalaceRoom): [number, number] {
  const a = roomAngle(room);
  return [Math.cos(a), Math.sin(a)];
}

/** Rotation that turns room-local +z toward the atrium. */
export function roomRotationY(room: PalaceRoom): number {
  return normalizeAngle(-roomAngle(room) - Math.PI / 2);
}

export function roomSize(beliefCount: number): number {
  return clamp(8 + 0.6 * Math.sqrt(Math.max(0, beliefCount)), 8, 18);
}

/** Door in the atrium wall for a room: depends only on the room, not on the snapshot. */
export function doorFor(room: PalaceRoom): Vec3 {
  const [dx, dz] = roomDirection(room);
  return [ATRIUM_RADIUS * dx, 0, ATRIUM_RADIUS * dz];
}

export function roomLocalToWorld(room: RoomLayout, local: Vec3): Vec3 {
  const [lx, ly, lz] = local;
  const c = Math.cos(room.rotationY);
  const s = Math.sin(room.rotationY);
  return [room.center[0] + lx * c + lz * s, room.center[1] + ly, room.center[2] - lx * s + lz * c];
}

export function worldToRoomLocal(room: RoomLayout, world: Vec3): Vec3 {
  const dx = world[0] - room.center[0];
  const dz = world[2] - room.center[2];
  const c = Math.cos(room.rotationY);
  const s = Math.sin(room.rotationY);
  return [dx * c - dz * s, world[1] - room.center[1], dx * s + dz * c];
}

/** Midpoint of the room's own door wall (the end of the short doorway that starts at `door`). */
export function roomFront(room: RoomLayout): Vec3 {
  return roomLocalToWorld(room, [0, 0, room.size[1] / 2]);
}

/** Floor corners in world space, counter-clockwise from the back-left corner. */
export function roomCorners(room: RoomLayout): Array<[number, number]> {
  const [w, d] = room.size;
  const locals: Vec3[] = [
    [-w / 2, 0, -d / 2],
    [w / 2, 0, -d / 2],
    [w / 2, 0, d / 2],
    [-w / 2, 0, d / 2],
  ];
  return locals.map((l) => {
    const p = roomLocalToWorld(room, l);
    return [p[0], p[2]];
  });
}

/**
 * Floor polygon of the atrium, counter-clockwise, vertices at (k*30 - 15) degrees, as [x, z] pairs.
 * `radius` is the apothem (distance from the centre to each face), so the doors at radius 9 sit
 * exactly on a face. Shared by the scene meshes, collision and the minimap outline.
 */
export function atriumPolygon(radius = ATRIUM_RADIUS): Array<[number, number]> {
  const step = TWO_PI / ATRIUM_SIDES;
  const circumradius = radius / Math.cos(step / 2);
  return Array.from({ length: ATRIUM_SIDES }, (_, k) => {
    const a = k * step - step / 2;
    return [circumradius * Math.cos(a), circumradius * Math.sin(a)];
  });
}

/** Half-extent of the square that encloses the whole palace, for minimaps and orbit limits. */
export function layoutExtent(layout: PalaceLayout): number {
  let extent = layout.atriumRadius;
  for (const room of [...layout.rooms, layout.archive]) {
    const dist = Math.hypot(room.center[0], room.center[2]);
    const halfDiag = Math.hypot(room.size[0], room.size[1]) / 2;
    extent = Math.max(extent, dist + halfDiag);
  }
  return extent + 1;
}

/** World position -> [u, v] in 0..1, u along +x, v along +z. */
export function worldToMinimap(pos: Vec3, layout: PalaceLayout): [number, number] {
  const e = layoutExtent(layout);
  return [clamp((pos[0] / e + 1) / 2, 0, 1), clamp((pos[2] / e + 1) / 2, 0, 1)];
}

export function computeLayout(snapshot: PalaceSnapshot): PalaceLayout {
  const day = snapshot.day;
  const shown = snapshot.beliefs.filter((b) => isShownInRoom(b) && b.createdDay <= day);
  const superseded = snapshot.beliefs.filter((b) => b.status === "superseded" && b.createdDay <= day);

  const beliefsByRoom = new Map<Room, PalaceBelief[]>();
  for (const room of ROOMS) beliefsByRoom.set(room, []);
  for (const b of shown) beliefsByRoom.get(b.room)?.push(b);

  const rooms: RoomLayout[] = ROOMS.map((room) => {
    const size = roomSize(beliefsByRoom.get(room)?.length ?? 0);
    const distance = ATRIUM_RADIUS + size / 2 + DOORWAY_LENGTH;
    const [dx, dz] = roomDirection(room);
    return { room, center: [distance * dx, 0, distance * dz], size: [size, size], rotationY: roomRotationY(room), door: doorFor(room) };
  });
  const archive = archiveLayout(rooms);

  const placements = new Map<string, Placement>();
  const pedestalById = new Map<string, Vec3>();

  for (const roomLayout of rooms) {
    const room = roomLayout.room as Room;
    const beliefs = sortById(beliefsByRoom.get(room) ?? []);
    const grid = pedestalGrid(roomLayout.size, beliefs.length);
    for (const [belief, local] of assignSlots(beliefs, grid)) {
      pedestalById.set(belief.id, local);
      placements.set(belief.id, {
        id: belief.id,
        kind: "belief",
        room,
        position: roomLocalToWorld(roomLayout, local),
        rotationY: roomLayout.rotationY,
      });
    }

    const procedures = sortById(snapshot.procedures.filter((p) => p.room === room));
    procedures.forEach((p, i) => {
      const x = (i - (procedures.length - 1) / 2) * TABLE_SPACING;
      const local: Vec3 = [x, 0, -roomLayout.size[1] / 2 + TABLE_OFFSET_FROM_BACK_WALL];
      placements.set(p.id, { id: p.id, kind: "procedure", room, position: roomLocalToWorld(roomLayout, local), rotationY: roomLayout.rotationY });
    });
  }

  placePaintings(snapshot, rooms, shown, pedestalById, placements);

  const archived = sortById(superseded);
  const archiveGrid = gridSlots(ARCHIVE_SIZE - 2 * ARCHIVE_MARGIN, ARCHIVE_SIZE - 2 * ARCHIVE_MARGIN, archived.length, 0);
  for (const [belief, local] of assignSlots(archived, archiveGrid)) {
    placements.set(belief.id, {
      id: belief.id,
      kind: "archive",
      room: "Archive",
      position: roomLocalToWorld(archive, local),
      rotationY: archive.rotationY,
    });
  }

  return { atriumRadius: ATRIUM_RADIUS, rooms, archive, placements };
}

// ---------------------------------------------------------------------------
// Archive alcove
// ---------------------------------------------------------------------------

/**
 * The alcove sits at 330° and at least 13 m out. Between two 8 m+ rooms that distance can clip
 * their corners, so it slides outward (in 0.25 m steps) until it clears every room by 0.5 m.
 */
function archiveLayout(rooms: readonly RoomLayout[]): RoomLayout {
  const [dx, dz] = roomDirection("Archive");
  const rotationY = roomRotationY("Archive");
  let distance = ARCHIVE_MIN_DISTANCE;
  for (let i = 0; i < 200; i++) {
    const candidate: RoomLayout = { room: "Archive", center: [distance * dx, 0, distance * dz], size: [ARCHIVE_SIZE, ARCHIVE_SIZE], rotationY, door: doorFor("Archive") };
    if (rooms.every((r) => !roomsOverlap(candidate, r, ROOM_CLEARANCE))) return candidate;
    distance += 0.25;
  }
  return { room: "Archive", center: [distance * dx, 0, distance * dz], size: [ARCHIVE_SIZE, ARCHIVE_SIZE], rotationY, door: doorFor("Archive") };
}

/** Separating-axis test between two rotated rectangles, grown by `margin`. */
export function roomsOverlap(a: RoomLayout, b: RoomLayout, margin = 0): boolean {
  const ca = roomCorners(a);
  const cb = roomCorners(b);
  const axes: Array<[number, number]> = [];
  for (const corners of [ca, cb]) {
    for (let i = 0; i < 2; i++) {
      const p = corners[i];
      const q = corners[i + 1];
      const ex = q[0] - p[0];
      const ez = q[1] - p[1];
      const len = Math.hypot(ex, ez) || 1;
      axes.push([-ez / len, ex / len]);
    }
  }
  for (const [ax, az] of axes) {
    const pa = project(ca, ax, az);
    const pb = project(cb, ax, az);
    if (pa.max + margin < pb.min || pb.max + margin < pa.min) return false;
  }
  return true;
}

function project(corners: ReadonlyArray<[number, number]>, ax: number, az: number): { min: number; max: number } {
  let min = Infinity;
  let max = -Infinity;
  for (const [x, z] of corners) {
    const d = x * ax + z * az;
    min = Math.min(min, d);
    max = Math.max(max, d);
  }
  return { min, max };
}

// ---------------------------------------------------------------------------
// Slots
// ---------------------------------------------------------------------------

interface Grid {
  slots: Vec3[];
}

function pedestalGrid(size: [number, number], count: number): Grid {
  const usableWidth = size[0] - 2 * PEDESTAL_MARGIN;
  const usableDepth = size[1] - PEDESTAL_BACK_MARGIN - PEDESTAL_FRONT_MARGIN;
  const zOffset = (PEDESTAL_FRONT_MARGIN - PEDESTAL_BACK_MARGIN) / 2;
  return gridSlots(usableWidth, usableDepth, count, -zOffset);
}

/** Centered grid of `count` slots (at least one) inside a `width x depth` rectangle. */
function gridSlots(width: number, depth: number, count: number, zCenter: number): Grid {
  const n = Math.max(1, count);
  const cols = Math.max(1, Math.ceil(Math.sqrt((n * width) / depth)));
  const rows = Math.max(1, Math.ceil(n / cols));
  const dx = cols > 1 ? width / (cols - 1) : 0;
  const dz = rows > 1 ? depth / (rows - 1) : 0;
  const slots: Vec3[] = [];
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const x = cols > 1 ? -width / 2 + c * dx : 0;
      const z = rows > 1 ? -depth / 2 + r * dz : 0;
      slots.push([x, 0, z + zCenter]);
    }
  }
  return { slots };
}

/** Hash each id into a slot; linear-probe collisions in sorted-id order so the result is stable. */
function assignSlots<T extends { id: string }>(items: readonly T[], grid: Grid): Array<[T, Vec3]> {
  const taken = new Array<boolean>(grid.slots.length).fill(false);
  const out: Array<[T, Vec3]> = [];
  for (const item of items) {
    let slot = fnv1a(item.id) % grid.slots.length;
    for (let probe = 0; probe < grid.slots.length && taken[slot]; probe++) slot = (slot + 1) % grid.slots.length;
    taken[slot] = true;
    out.push([item, grid.slots[slot]]);
  }
  return out;
}

// ---------------------------------------------------------------------------
// Paintings
// ---------------------------------------------------------------------------

interface WallSlot {
  local: Vec3;
  /** Rotation relative to the room so the painting faces into it. */
  localRotationY: number;
  row: number;
}

function wallSlots(size: [number, number]): WallSlot[] {
  const [w, d] = size;
  const slots: WallSlot[] = [];
  for (let row = 0; row < PAINTING_ROWS_Y.length; row++) {
    const y = PAINTING_ROWS_Y[row];
    for (const x of along(w)) slots.push({ local: [x, y, -d / 2 + PAINTING_WALL_OFFSET], localRotationY: 0, row });
    for (const z of along(d)) slots.push({ local: [-w / 2 + PAINTING_WALL_OFFSET, y, z], localRotationY: Math.PI / 2, row });
    for (const z of along(d)) slots.push({ local: [w / 2 - PAINTING_WALL_OFFSET, y, z], localRotationY: -Math.PI / 2, row });
  }
  return slots;
}

function along(length: number): number[] {
  const usable = length - 2 * PAINTING_WALL_MARGIN;
  const n = Math.max(1, Math.floor(usable / PAINTING_SPACING) + 1);
  const step = n > 1 ? usable / (n - 1) : 0;
  return Array.from({ length: n }, (_, i) => -usable / 2 + i * step);
}

function placePaintings(
  snapshot: PalaceSnapshot,
  rooms: readonly RoomLayout[],
  shown: readonly PalaceBelief[],
  pedestalById: ReadonlyMap<string, Vec3>,
  placements: Map<string, Placement>,
): void {
  const beliefById = new Map(shown.map((b) => [b.id, b]));
  const supporters = new Map<string, PalaceBelief[]>();
  const addSupport = (captureId: string, belief: PalaceBelief | undefined) => {
    if (!belief) return;
    const list = supporters.get(captureId) ?? [];
    if (!list.includes(belief)) list.push(belief);
    supporters.set(captureId, list);
  };
  for (const b of shown) for (const c of b.evidence) addSupport(c, b);
  for (const e of snapshot.edges) if (e.type === "evidence") addSupport(e.to, beliefById.get(e.from));

  // Supported captures hang first (behind their belief); orphans, such as a fresh replay's page loads
  // before extraction has produced a belief, hang in the room their app belongs to while slots remain.
  const present = snapshot.captures.filter((c) => c.day <= snapshot.day);
  const captures = [...sortById(present.filter((c) => supporters.has(c.id))), ...sortById(present.filter((c) => !supporters.has(c.id)))];
  const freeSlotsByRoom = new Map<Room, WallSlot[]>();
  const roomLayouts = new Map<Room, RoomLayout>();
  for (const r of rooms) {
    roomLayouts.set(r.room as Room, r);
    freeSlotsByRoom.set(r.room as Room, wallSlots(r.size));
  }

  for (const capture of captures) {
    const anchor = pickAnchor(supporters.get(capture.id) ?? []);
    const room = anchor?.room ?? ROOM_BY_APP[capture.app];
    const roomLayout = roomLayouts.get(room);
    const free = freeSlotsByRoom.get(room);
    if (!roomLayout || !free || free.length === 0) continue;
    const pedestal = (anchor && pedestalById.get(anchor.id)) ?? [0, 0, 0];
    let bestIndex = -1;
    let bestScore = Infinity;
    for (let i = 0; i < free.length; i++) {
      const s = free[i];
      const score = Math.hypot(s.local[0] - pedestal[0], s.local[2] - pedestal[2]) + s.row * 6;
      if (score < bestScore) {
        bestScore = score;
        bestIndex = i;
      }
    }
    const [slot] = free.splice(bestIndex, 1);
    placements.set(capture.id, {
      id: capture.id,
      kind: "painting",
      room,
      position: roomLocalToWorld(roomLayout, slot.local),
      rotationY: normalizeAngle(roomLayout.rotationY + slot.localRotationY),
    });
  }
}

/** Where an unsupported capture hangs, by the app it came from. */
const ROOM_BY_APP: Record<PalaceCapture["app"], Room> = { mockloft: "Housing", landlord_chat: "Housing", inbox: "Work", calendar: "Work", desktop: "Misc" };

/** The belief a painting hangs behind: the strongest supporter, ties broken by id. */
function pickAnchor(beliefs: readonly PalaceBelief[]): PalaceBelief | undefined {
  return [...beliefs].sort((a, b) => b.confidence - a.confidence || (a.id < b.id ? -1 : 1))[0];
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

export function roomLayoutFor(layout: PalaceLayout, room: PalaceRoom): RoomLayout {
  return room === "Archive" ? layout.archive : (layout.rooms.find((r) => r.room === room) ?? layout.archive);
}

/** Which room (or the atrium, null) a world position is inside. */
export function roomAt(layout: PalaceLayout, pos: Vec3): PalaceRoom | null {
  for (const r of [...layout.rooms, layout.archive]) {
    const [lx, , lz] = worldToRoomLocal(r, pos);
    if (Math.abs(lx) <= r.size[0] / 2 && Math.abs(lz) <= r.size[1] / 2) return r.room;
  }
  return null;
}

/** Filter a capture list to the ones that have a painting slot. */
export function placedCaptures(layout: PalaceLayout, captures: readonly PalaceCapture[]): PalaceCapture[] {
  return captures.filter((c) => layout.placements.get(c.id)?.kind === "painting");
}

function sortById<T extends { id: string }>(items: readonly T[]): T[] {
  return [...items].sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
}

function clamp(v: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, v));
}

function normalizeAngle(a: number): number {
  let r = a % TWO_PI;
  if (r <= -Math.PI) r += TWO_PI;
  if (r > Math.PI) r -= TWO_PI;
  return r;
}
