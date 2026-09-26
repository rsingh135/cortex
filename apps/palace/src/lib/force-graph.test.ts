/**
 * The force layout over the real demo graph, with the options MemoryExplorer passes.
 * These are the properties that make the graph feel like a knowledge graph rather than a grid:
 * connected memories sit together, rooms stay legible, and nothing overlaps.
 */
import { describe, expect, it } from "vitest";
import { ROOMS } from "@cortex/schema";
import { graphDemo } from "./graph-demo";
import { projectMemoryGraph, type MemoryGraphNode } from "./memory-graph";
import { createSimulation, type Vec } from "./force";

const radiusOf = (node: MemoryGraphNode, degree: Map<string, number>) => {
  const base =
    node.kind === "procedure" ? 16 : node.kind === "capture" ? 11 : 14;
  return base + Math.min(10, Math.sqrt(degree.get(node.id) ?? 0) * 3.4);
};

function settled() {
  const graph = projectMemoryGraph(graphDemo().payload);
  const degree = new Map<string, number>();
  for (const edge of graph.edges) {
    degree.set(edge.from, (degree.get(edge.from) ?? 0) + 1);
    degree.set(edge.to, (degree.get(edge.to) ?? 0) + 1);
  }
  const simulation = createSimulation(
    graph.nodes.map((node) => ({
      id: node.id,
      x: node.x,
      y: node.y,
      radius: radiusOf(node, degree) + 12,
      group: node.room,
    })),
    graph.edges.map((edge) => ({
      source: edge.from,
      target: edge.to,
      weight: edge.weight,
    })),
    {
      dimensions: 2,
      groupCenters: Object.fromEntries(
        ROOMS.map((name) => [
          name,
          {
            x: graph.roomCenters[name].x,
            y: graph.roomCenters[name].y,
            z: 0,
          } satisfies Vec,
        ]),
      ),
      linkDistance: 94,
      repulsion: 3400,
      repulsionCutoff: 320,
      groupGravity: 0.03,
    },
  );
  const steps = simulation.settle(1200);
  const room = new Map(graph.nodes.map((node) => [node.id, node.room]));
  return { graph, simulation, steps, room, degree };
}

describe("force layout on the demo graph", () => {
  it("settles and leaves no two glyphs overlapping", () => {
    const { simulation, steps } = settled();
    expect(steps).toBeGreaterThan(10);
    expect(simulation.running).toBe(false);
    const nodes = simulation.nodes;
    for (let i = 0; i < nodes.length; i++)
      for (let j = i + 1; j < nodes.length; j++) {
        const a = nodes[i]!,
          b = nodes[j]!;
        expect(Math.hypot(a.x - b.x, a.y - b.y)).toBeGreaterThan(
          a.radius + b.radius - 0.01,
        );
      }
  });

  it("puts connected memories closer together than unconnected ones", () => {
    const { graph, simulation } = settled();
    const at = (id: string) => simulation.position(id)!;
    const gap = (a: string, b: string) =>
      Math.hypot(at(a).x - at(b).x, at(a).y - at(b).y);

    const linked = new Set(
      graph.edges.map((edge) => [edge.from, edge.to].sort().join("|")),
    );
    const ids = simulation.nodes.map((node) => node.id);
    const connected: number[] = [];
    const unconnected: number[] = [];
    for (let i = 0; i < ids.length; i++)
      for (let j = i + 1; j < ids.length; j++) {
        const pair = [ids[i]!, ids[j]!].sort().join("|");
        (linked.has(pair) ? connected : unconnected).push(gap(ids[i]!, ids[j]!));
      }
    const mean = (xs: number[]) => xs.reduce((s, x) => s + x, 0) / xs.length;
    expect(connected.length).toBeGreaterThan(0);
    // The whole point of the solver: an edge is a shorter distance than no edge.
    expect(mean(connected)).toBeLessThan(mean(unconnected));
  });

  it("keeps each room's memories nearer their own room than any other", () => {
    const { graph, simulation, room } = settled();
    const centers = graph.roomCenters;
    let correct = 0;
    let total = 0;
    for (const node of simulation.nodes) {
      const own = room.get(node.id)!;
      const distanceTo = (name: typeof own) =>
        Math.hypot(node.x - centers[name].x, node.y - centers[name].y);
      const nearest = ROOMS.reduce((best, name) =>
        distanceTo(name) < distanceTo(best) ? name : best,
      );
      total += 1;
      if (nearest === own) correct += 1;
    }
    // Shared evidence legitimately pulls a few nodes between rooms; the clusters still read.
    expect(correct / total).toBeGreaterThan(0.8);
  });

  it("is reproducible, so the demo looks the same every run", () => {
    const first = settled().simulation.nodes.map(
      (n) => `${n.id}:${n.x.toFixed(6)}:${n.y.toFixed(6)}`,
    );
    const second = settled().simulation.nodes.map(
      (n) => `${n.id}:${n.x.toFixed(6)}:${n.y.toFixed(6)}`,
    );
    expect(second).toEqual(first);
  });

  it("gives hubs a larger glyph than leaves", () => {
    const { degree, graph } = settled();
    const beliefs = graph.nodes.filter((n) => n.kind === "belief");
    const hub = beliefs.reduce((best, n) =>
      (degree.get(n.id) ?? 0) > (degree.get(best.id) ?? 0) ? n : best,
    );
    const leaf = beliefs.reduce((best, n) =>
      (degree.get(n.id) ?? 0) < (degree.get(best.id) ?? 0) ? n : best,
    );
    expect(degree.get(hub.id) ?? 0).toBeGreaterThan(degree.get(leaf.id) ?? 0);
    expect(radiusOf(hub, degree)).toBeGreaterThan(radiusOf(leaf, degree));
  });
});
