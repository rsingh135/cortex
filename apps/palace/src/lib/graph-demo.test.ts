import { Snapshot } from "@cortex/schema";
import { describe, expect, it } from "vitest";
import { graphDemo } from "./graph-demo";
import { projectMemoryGraph } from "./memory-graph";

describe("memory graph demo", () => {
  it("validates as a snapshot and projects only links with existing endpoints", () => {
    const demo = graphDemo();
    expect(Snapshot.safeParse(demo).success).toBe(true);
    const graph = projectMemoryGraph(demo.payload);
    const ids = new Set(graph.nodes.map((node) => node.id));
    expect(graph.nodes.length).toBeGreaterThan(0);
    expect(graph.edges.length).toBeGreaterThan(0);
    expect(
      graph.edges.every((edge) => ids.has(edge.from) && ids.has(edge.to)),
    ).toBe(true);
    expect(graphDemo()).toEqual(demo);
  });
});
