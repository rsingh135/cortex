import { describe, expect, it } from "vitest";
import { generateFixture } from "./fixtures/generate";
import { MIN_PLACEMENT_GAP, computeLayout, doorFor, roomAngle, roomAt, roomCorners, roomsOverlap, worldToMinimap, worldToRoomLocal } from "./layout";

const snapshot = generateFixture(42);
const layout = computeLayout(snapshot);

describe("computeLayout", () => {
  it("is deterministic", () => {
    const again = computeLayout(generateFixture(42));
    expect([...again.placements.entries()]).toEqual([...layout.placements.entries()]);
    expect(again.rooms).toEqual(layout.rooms);
    expect(again.archive).toEqual(layout.archive);
  });

  it("places every shown belief, every procedure and every superseded belief", () => {
    for (const b of snapshot.beliefs) {
      const p = layout.placements.get(b.id);
      if (b.status === "active" || b.status === "cracked") expect(p?.kind).toBe("belief");
      else if (b.status === "superseded") expect(p?.kind).toBe("archive");
    }
    for (const p of snapshot.procedures) expect(layout.placements.get(p.id)?.kind).toBe("procedure");
    const paintings = [...layout.placements.values()].filter((p) => p.kind === "painting");
    expect(paintings.length).toBeGreaterThan(50);
  });

  it("keeps placements in the same room at least 0.4m apart", () => {
    const byRoom = new Map<string, Array<[number, number, number]>>();
    for (const p of layout.placements.values()) byRoom.set(p.room, [...(byRoom.get(p.room) ?? []), p.position]);
    for (const [room, positions] of byRoom) {
      for (let i = 0; i < positions.length; i++) {
        for (let j = i + 1; j < positions.length; j++) {
          const a = positions[i];
          const b = positions[j];
          const d = Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
          expect(d, `${room} placements ${i} and ${j}`).toBeGreaterThanOrEqual(MIN_PLACEMENT_GAP);
        }
      }
    }
  });

  it("keeps every placement inside its room's footprint", () => {
    const rooms = new Map([...layout.rooms, layout.archive].map((r) => [r.room, r]));
    for (const p of layout.placements.values()) {
      const r = rooms.get(p.room);
      expect(r).toBeDefined();
      if (!r) continue;
      const [lx, ly, lz] = worldToRoomLocal(r, p.position);
      expect(Math.abs(lx)).toBeLessThanOrEqual(r.size[0] / 2 + 1e-6);
      expect(Math.abs(lz)).toBeLessThanOrEqual(r.size[1] / 2 + 1e-6);
      expect(ly).toBeGreaterThanOrEqual(0);
      expect(ly).toBeLessThanOrEqual(4);
      expect(roomAt(layout, p.position)).toBe(p.room);
    }
  });

  it("sizes rooms within [8, 18] and does not let rooms overlap", () => {
    const all = [...layout.rooms, layout.archive];
    for (const r of layout.rooms) {
      expect(r.size[0]).toBeGreaterThanOrEqual(8);
      expect(r.size[0]).toBeLessThanOrEqual(18);
      expect(r.size[0]).toBe(r.size[1]);
    }
    expect(layout.archive.size).toEqual([6, 6]);
    for (let i = 0; i < all.length; i++) for (let j = i + 1; j < all.length; j++) expect(roomsOverlap(all[i], all[j]), `${all[i].room} vs ${all[j].room}`).toBe(false);
  });

  it("puts rooms at 60 degree increments with doors on the atrium edge", () => {
    expect(roomAngle("Housing")).toBe(0);
    expect(roomAngle("Health")).toBeCloseTo(Math.PI);
    for (const r of layout.rooms) {
      const [dx, , dz] = doorFor(r.room);
      expect(Math.hypot(dx, dz)).toBeCloseTo(9);
      expect(r.door).toEqual(doorFor(r.room));
      const dist = Math.hypot(r.center[0], r.center[2]);
      expect(dist).toBeCloseTo(9 + r.size[1] / 2 + 1.5);
      // The room's local +z axis points back at the origin.
      const [, , lz] = worldToRoomLocal(r, [0, 0, 0]);
      expect(lz).toBeGreaterThan(0);
    }
    expect(roomCorners(layout.archive)).toHaveLength(4);
  });

  it("maps world positions into the unit square", () => {
    for (const p of layout.placements.values()) {
      const [u, v] = worldToMinimap(p.position, layout);
      expect(u).toBeGreaterThanOrEqual(0);
      expect(u).toBeLessThanOrEqual(1);
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThanOrEqual(1);
    }
    expect(worldToMinimap([0, 0, 0], layout)).toEqual([0.5, 0.5]);
  });
});
