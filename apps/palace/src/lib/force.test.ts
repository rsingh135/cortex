import { describe, expect, it } from "vitest";
import { createSimulation, type SimLink, type SimulationSeed } from "./force";

const seeds = (count: number, spread = 4): SimulationSeed[] =>
  Array.from({ length: count }, (_, i) => ({
    id: `n${String(i).padStart(2, "0")}`,
    x: (i % 5) * spread,
    y: Math.floor(i / 5) * spread,
    radius: 14,
    group: i % 2 ? "a" : "b",
  }));

const chain = (count: number): SimLink[] =>
  Array.from({ length: count - 1 }, (_, i) => ({
    source: `n${String(i).padStart(2, "0")}`,
    target: `n${String(i + 1).padStart(2, "0")}`,
    weight: 1,
  }));

const minGap = (sim: ReturnType<typeof createSimulation>) => {
  let min = Infinity;
  const nodes = sim.nodes;
  for (let i = 0; i < nodes.length; i++)
    for (let j = i + 1; j < nodes.length; j++) {
      const a = nodes[i]!,
        b = nodes[j]!;
      min = Math.min(
        min,
        Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z) - (a.radius + b.radius),
      );
    }
  return min;
};

describe("force layout", () => {
  it("is deterministic across runs and independent of seed order", () => {
    const run = (input: SimulationSeed[]) => {
      const sim = createSimulation(input, chain(12), {
        groupCenters: { a: { x: -120, y: 0, z: 0 }, b: { x: 120, y: 0, z: 0 } },
      });
      sim.settle();
      return sim.nodes.map((n) => [n.id, n.x.toFixed(9), n.y.toFixed(9)]);
    };
    const forward = run(seeds(12));
    expect(run(seeds(12))).toEqual(forward);
    expect(run([...seeds(12)].reverse())).toEqual(forward);
  });

  it("separates coincident nodes rather than dividing by zero", () => {
    const stacked: SimulationSeed[] = Array.from({ length: 6 }, (_, i) => ({
      id: `same${i}`,
      x: 0,
      y: 0,
      radius: 10,
    }));
    const sim = createSimulation(stacked, []);
    sim.settle();
    for (const node of sim.nodes) {
      expect(Number.isFinite(node.x)).toBe(true);
      expect(Number.isFinite(node.y)).toBe(true);
    }
    expect(minGap(sim)).toBeGreaterThan(-0.001);
  });

  it("leaves no glyphs overlapping once it has cooled", () => {
    const sim = createSimulation(seeds(40, 2), chain(40));
    sim.settle();
    expect(sim.running).toBe(false);
    expect(minGap(sim)).toBeGreaterThan(-0.001);
  });

  it("pulls linked nodes closer than unlinked ones", () => {
    const sim = createSimulation(seeds(10, 30), [
      { source: "n00", target: "n01", weight: 1 },
    ]);
    sim.settle();
    const at = (id: string) => sim.position(id)!;
    const linked = Math.hypot(at("n00").x - at("n01").x, at("n00").y - at("n01").y);
    const far = Math.hypot(at("n00").x - at("n09").x, at("n00").y - at("n09").y);
    expect(linked).toBeLessThan(far);
  });

  it("keeps groups apart around their own centers", () => {
    const sim = createSimulation(seeds(24, 3), [], {
      groupGravity: 0.09,
      groupCenters: { a: { x: -400, y: 0, z: 0 }, b: { x: 400, y: 0, z: 0 } },
    });
    sim.settle(800);
    const mean = (group: string) => {
      const members = sim.nodes.filter((n) => n.group === group);
      return members.reduce((sum, n) => sum + n.x, 0) / members.length;
    };
    expect(mean("a")).toBeLessThan(-100);
    expect(mean("b")).toBeGreaterThan(100);
  });

  it("holds a pinned node still and reheats on demand", () => {
    const sim = createSimulation(seeds(12, 6), chain(12));
    sim.settle();
    sim.pin("n05", { x: 500, y: -500 });
    sim.reheat();
    expect(sim.running).toBe(true);
    sim.settle();
    expect(sim.position("n05")).toMatchObject({ x: 500, y: -500 });
    sim.unpin("n05");
    sim.reheat();
    sim.settle();
    // Released, it is pulled back toward the graph rather than left at the far corner.
    expect(sim.position("n05")!.x).toBeLessThan(500);
  });

  it("keeps 2D flat and lets 3D use depth", () => {
    const flat = createSimulation(seeds(14, 5), chain(14), { dimensions: 2 });
    flat.settle();
    expect(flat.nodes.every((n) => n.z === 0)).toBe(true);

    const deep = createSimulation(
      seeds(14, 5).map((s, i) => ({ ...s, z: (i % 3) * 9 })),
      chain(14),
      { dimensions: 3 },
    );
    deep.settle();
    expect(deep.nodes.some((n) => Math.abs(n.z) > 0.5)).toBe(true);
    expect(deep.nodes.every((n) => Number.isFinite(n.z))).toBe(true);
  });

  it("ignores links to unknown or self ids", () => {
    const sim = createSimulation(seeds(4, 20), [
      { source: "n00", target: "n00", weight: 1 },
      { source: "n00", target: "ghost", weight: 1 },
    ]);
    expect(() => sim.settle()).not.toThrow();
    expect(sim.nodes.every((n) => n.degree === 0)).toBe(true);
  });

  it("cools to a stop within a bounded number of steps", () => {
    const sim = createSimulation(seeds(60, 3), chain(60));
    const taken = sim.settle(2000);
    expect(taken).toBeLessThan(700);
    expect(sim.alpha).toBe(0);
  });
});
