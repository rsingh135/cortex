import { describe, expect, it } from "vitest";
import { ROOMS } from "@cortex/schema";
import { generateFixture } from "./fixtures/generate";
import { CLUSTER_RADIUS, clusterCenter, computeGraphLayout, graphSpawn, selectGraphBeliefs } from "./graphLayout";

const snapshot = generateFixture(42);

describe("belief graph layout", () => {
  it("shows at most five beliefs per room, strongest first, never summaries", () => {
    const beliefs = selectGraphBeliefs(snapshot, 5);
    for (const room of ROOMS) {
      const inRoom = beliefs.filter((b) => b.room === room);
      expect(inRoom.length).toBeLessThanOrEqual(5);
      for (let i = 1; i < inRoom.length; i++) expect(inRoom[i - 1]!.confidence).toBeGreaterThanOrEqual(inRoom[i]!.confidence);
    }
    expect(beliefs.some((b) => b.kind === "summary")).toBe(false);
    expect(beliefs.length).toBeLessThanOrEqual(30);
    expect(beliefs.length).toBeGreaterThan(20);
  });

  it("is deterministic and keeps every node near its cluster with no two nodes overlapping", () => {
    const a = computeGraphLayout(snapshot);
    const b = computeGraphLayout(snapshot);
    expect([...a.nodes.values()]).toEqual([...b.nodes.values()]);
    const nodes = [...a.nodes.values()];
    for (const n of nodes) {
      const c = clusterCenter(n.room);
      expect(Math.hypot(n.position[0] - c[0], n.position[2] - c[2])).toBeLessThan(CLUSTER_RADIUS + 2);
    }
    for (let i = 0; i < nodes.length; i++) {
      for (let j = i + 1; j < nodes.length; j++) {
        const p = nodes[i]!.position;
        const q = nodes[j]!.position;
        expect(Math.hypot(p[0] - q[0], p[1] - q[1], p[2] - q[2])).toBeGreaterThan(0.6);
      }
    }
  });

  it("links only nodes that are on screen and adds shared-evidence links", () => {
    const layout = computeGraphLayout(snapshot);
    for (const l of layout.links) {
      expect(layout.nodes.has(l.from)).toBe(true);
      expect(layout.nodes.has(l.to)).toBe(true);
      expect(l.from).not.toBe(l.to);
    }
    expect(layout.links.length).toBeGreaterThan(0);
    expect(new Set(layout.links.map((l) => l.id)).size).toBe(layout.links.length);
  });

  it("spawns outside the ring facing the Housing cluster", () => {
    const { position } = graphSpawn();
    const [hx, , hz] = clusterCenter("Housing");
    expect(Math.hypot(position[0], position[2])).toBeGreaterThan(Math.hypot(hx, hz));
  });
});
