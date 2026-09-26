import { describe, expect, it } from "vitest";
import { computeLayout, roomAt, EYE_HEIGHT } from "@/lib/layout";
import { generateFixture } from "@/lib/fixtures/generate";
import { buildWalls, doorways, doorwayInFront, roomEntryPose, atriumEntryPose, overviewPose, atriumPolygon } from "@/scene/geometry";
import { collisionSet, resolveCollision, moveWithCollision } from "@/scene/collision";

const layout = computeLayout(generateFixture(42));

describe("scene geometry", () => {
  it("atrium polygon faces are centred on door angles", () => {
    const poly = atriumPolygon(9);
    expect(poly).toHaveLength(12);
    const a = poly[0], b = poly[1];
    const mid = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
    expect(Math.hypot(mid[0], mid[1])).toBeCloseTo(9, 6);
    expect(Math.atan2(mid[1], mid[0])).toBeCloseTo(0, 6);
  });
  it("builds walls for atrium, 7 doorways and 7 rooms", () => {
    const walls = buildWalls(layout);
    const atrium = walls.filter((w) => w.owner === "atrium");
    // 5 solid faces + 7 doors * 3 pieces
    expect(atrium).toHaveLength(5 + 7 * 3);
    expect(doorways(layout)).toHaveLength(7);
    for (const w of walls) expect(w.top).toBeGreaterThan(w.base);
  });
  it("doorway outer sits on the atrium wall and inner on the room front", () => {
    for (const d of doorways(layout)) {
      expect(Math.hypot(d.outer[0], d.outer[2])).toBeCloseTo(9, 6);
      expect(d.length).toBeGreaterThan(0.9);
      const pose = roomEntryPose(layout.rooms.find((r) => r.room === d.room) ?? layout.archive);
      expect(roomAt(layout, pose.position)).toBe(d.room);
      expect(pose.position[1]).toBe(EYE_HEIGHT);
      const back = atriumEntryPose(d);
      expect(roomAt(layout, back.position)).toBeNull();
      expect(Math.hypot(back.position[0], back.position[2])).toBeLessThan(9);
    }
  });
  it("collision keeps a walker inside the atrium but lets it through a door", () => {
    const walls = collisionSet(layout);
    // Walk into a solid face at 30 degrees.
    const a = Math.PI / 6;
    let solid: [number, number] = [0, 0];
    for (let i = 0; i < 300; i++) solid = moveWithCollision(walls, solid, [solid[0] + 0.05 * Math.cos(a), solid[1] + 0.05 * Math.sin(a)]);
    expect(Math.hypot(solid[0], solid[1])).toBeLessThan(9);
    expect(Math.hypot(solid[0], solid[1])).toBeGreaterThan(8);
    // Walk straight through the Housing door along +x.
    let pos: [number, number] = [7, 0];
    for (let i = 0; i < 120; i++) pos = moveWithCollision(walls, pos, [pos[0] + 0.05, pos[1]]);
    expect(pos[0]).toBeGreaterThan(11);
    expect(roomAt(layout, [pos[0], 0, pos[1]])).toBe("Housing");
    // Free movement in the middle is untouched.
    expect(resolveCollision(walls, [1, 1])).toEqual([1, 1]);
  });
  it("finds the door in front", () => {
    const d = doorwayInFront(doorways(layout), [5, EYE_HEIGHT, 0], [1, 0]);
    expect(d?.room).toBe("Housing");
    expect(doorwayInFront(doorways(layout), [0, EYE_HEIGHT, 0], [1, 0])).toBeNull();
    const pose = overviewPose(layout);
    expect(pose.position[1]).toBeGreaterThan(20);
  });
});
