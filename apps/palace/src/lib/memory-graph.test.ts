import { ROOMS, type Room } from "@cortex/schema";
import { describe, expect, it } from "vitest";
import {
  NODE_SPACING,
  projectMemoryGraph,
  type MemoryPayload,
} from "./memory-graph";

function belief(
  id: string,
  room: Room = "Housing",
  evidence: string[] = [],
): MemoryPayload["beliefs"][number] {
  return {
    _id: id,
    triple: { s: "maya", p: "prefers", o: "quiet" },
    text: id,
    kind: "preference",
    room,
    source: "screen",
    inferred: false,
    pinned: false,
    c0: 0.8,
    confidence: 0.7,
    evidence,
    created_day: 0,
    history: [],
    status: "active",
  };
}
function capture(id: string): MemoryPayload["captures"][number] {
  return {
    _id: id,
    episode_id: "episode",
    day: 0,
    ts: "2026-09-26T00:00:00.000Z",
    actor: "maya",
    app: "mockloft",
    url: "https://example.com/listing",
    title: id,
    action: { type: "load" },
    phash: "0",
    extracted: true,
    belief_ids: [],
    l0_bytes: 10,
    alive_levels: ["L1"],
    ceiling: "L1",
    clarity: 0.5,
  };
}
function fixture(): MemoryPayload {
  return {
    beliefs: [
      belief("budget", "Housing", ["capture-a", "capture-a", "missing"]),
      belief("work", "Work"),
    ],
    captures: [capture("capture-a"), capture("unlinked")],
    procedures: [
      {
        _id: "procedure",
        name: "Apartment hunt",
        description: "Search for housing",
        room: "Housing",
        status: "active",
        steps: [],
        decision_attributes: [],
        learned_from: [],
        runs: 0,
        cracked_by: [],
      },
    ],
    edges: [
      {
        _id: "explicit",
        from: "budget",
        to: "capture-a",
        type: "evidence",
        weight: 0.7,
      },
      {
        _id: "duplicate",
        from: "budget",
        to: "capture-a",
        type: "evidence",
        weight: 0.8,
      },
      { _id: "uses", from: "procedure", to: "budget", type: "uses", weight: 1 },
      {
        _id: "derived",
        from: "work",
        to: "budget",
        type: "derived_from",
        weight: 1,
      },
      { _id: "dangling", from: "gone", to: "work", type: "uses", weight: 1 },
    ],
  };
}

describe("memory graph projection", () => {
  it("keeps only existing endpoints, deduplicates links, and fills missing evidence directly from records", () => {
    const data = fixture();
    data.beliefs[1].evidence = ["capture-a"];
    const graph = projectMemoryGraph(data);
    const ids = new Set(graph.nodes.map((node) => node.id));
    expect(
      graph.edges.every((edge) => ids.has(edge.from) && ids.has(edge.to)),
    ).toBe(true);
    expect(
      graph.edges.filter(
        (edge) => edge.from === "budget" && edge.to === "capture-a",
      ),
    ).toHaveLength(1);
    expect(
      graph.edges.find(
        (edge) => edge.from === "budget" && edge.to === "capture-a",
      ),
    ).toMatchObject({ origin: "canonical", id: "duplicate", weight: 0.8 });
    expect(
      graph.edges.find(
        (edge) => edge.from === "work" && edge.to === "capture-a",
      ),
    ).toMatchObject({ type: "evidence", origin: "evidence" });
    expect(graph.edges).toHaveLength(4);
    expect(graph.nodes.find((node) => node.id === "capture-a")?.room).toBe(
      "Housing",
    );
    expect(graph.nodes.find((node) => node.id === "unlinked")?.room).toBe(
      "Misc",
    );
    expect(graph.nodes.find((node) => node.id === "budget")).toMatchObject({
      kind: "belief",
      confidence: 0.7,
      source: data.beliefs[0],
    });
    expect(graph.nodes.find((node) => node.id === "capture-a")).toMatchObject({
      kind: "capture",
      clarity: 0.5,
    });
  });

  it("does not invent links from shared rooms, text, or procedure metadata", () => {
    const data = fixture();
    data.edges = [];
    data.beliefs.forEach((item) => {
      item.evidence = [];
    });
    data.procedures[0].steps = [{ n: 1, do: "decide", uses: ["budget"] }];
    data.procedures[0].learned_from = ["work"];
    expect(projectMemoryGraph(data).edges).toEqual([]);
  });

  it("preserves link direction and separate relationship types", () => {
    const data = fixture();
    data.edges.push({
      _id: "reverse",
      from: "budget",
      to: "work",
      type: "derived_from",
      weight: 1,
    });
    data.edges.push({
      _id: "different",
      from: "work",
      to: "budget",
      type: "supersedes",
      weight: 1,
    });
    const edges = projectMemoryGraph(data).edges;
    expect(
      edges.filter((edge) => edge.from === "work" && edge.to === "budget"),
    ).toHaveLength(2);
    expect(edges.find((edge) => edge.id === "reverse")).toMatchObject({
      from: "budget",
      to: "work",
    });
  });

  it("keeps exactly one hop of context around search matches and preserves positions while filtering", () => {
    const data = fixture();
    data.beliefs.push(belief("remote", "Social"));
    data.edges.push({
      _id: "second-hop",
      from: "remote",
      to: "work",
      type: "derived_from",
      weight: 1,
    });
    const all = projectMemoryGraph(data);
    const filtered = projectMemoryGraph(data, { search: "budget" });
    expect(filtered.matchedIds).toEqual(["budget"]);
    expect(filtered.nodes.map((node) => node.id)).toEqual([
      "budget",
      "capture-a",
      "procedure",
      "work",
    ]);
    expect(filtered.nodes.find((node) => node.id === "work")?.contextual).toBe(
      true,
    );
    expect(
      filtered.nodes.find((node) => node.id === "budget")?.contextual,
    ).toBe(false);
    for (const node of filtered.nodes)
      expect(node).toMatchObject({
        x: all.nodes.find((item) => item.id === node.id)!.x,
        y: all.nodes.find((item) => item.id === node.id)!.y,
      });
    expect(projectMemoryGraph(data, { search: "unknown-word" }).nodes).toEqual(
      [],
    );
  });

  it("combines room/search filters and never restores hidden evidence as context", () => {
    const data = fixture();
    const graph = projectMemoryGraph(data, {
      room: "Housing",
      search: "budget",
      showEvidence: false,
    });
    expect(graph.matchedIds).toEqual(["budget"]);
    expect(graph.nodes.map((node) => node.id)).toEqual([
      "budget",
      "procedure",
      "work",
    ]);
    expect(graph.edges.every((edge) => edge.type !== "evidence")).toBe(true);
    expect(
      projectMemoryGraph(data, { room: "Social", search: "budget" }).nodes,
    ).toEqual([]);
  });

  it("is independent of input ordering and leaves source records untouched", () => {
    const data = fixture();
    const before = structuredClone(data);
    const graph = projectMemoryGraph(data);
    const shuffled = Object.fromEntries(
      Object.entries(data).map(([key, items]) => [key, [...items].reverse()]),
    ) as MemoryPayload;
    expect(projectMemoryGraph(shuffled)).toEqual(graph);
    expect(data).toEqual(before);
  });

  it("keeps room clusters and node glyphs apart for normal and dense datasets", () => {
    const data: MemoryPayload = {
      beliefs: [],
      captures: [],
      procedures: [],
      edges: [],
    };
    for (const room of ROOMS)
      for (let i = 0; i < 55; i++)
        data.beliefs.push(
          belief(`${room}-${String(i).padStart(3, "0")}`, room),
        );
    const normal = projectMemoryGraph(data);
    expect(normal.width).toBeGreaterThanOrEqual(1200);
    expect(normal.height).toBeGreaterThanOrEqual(800);
    for (let i = 55; i < 150; i++)
      data.beliefs.push(belief(`Housing-${String(i).padStart(3, "0")}`));
    for (const graph of [normal, projectMemoryGraph(data)]) {
      for (let i = 0; i < graph.nodes.length; i++) {
        const a = graph.nodes[i];
        expect(a.x).toBeGreaterThanOrEqual(20);
        expect(a.x).toBeLessThanOrEqual(graph.width - 20);
        expect(a.y).toBeGreaterThanOrEqual(20);
        expect(a.y).toBeLessThanOrEqual(graph.height - 20);
        for (const b of graph.nodes.slice(i + 1))
          expect(Math.hypot(a.x - b.x, a.y - b.y)).toBeGreaterThanOrEqual(
            NODE_SPACING - 1e-8,
          );
      }
    }
  });

  it("returns a finite empty canvas for an empty snapshot", () => {
    const graph = projectMemoryGraph({
      beliefs: [],
      captures: [],
      procedures: [],
      edges: [],
    });
    expect(graph).toMatchObject({
      nodes: [],
      edges: [],
      matchedIds: [],
      width: 1200,
      height: 800,
    });
  });
});
