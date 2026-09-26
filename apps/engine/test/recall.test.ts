import { describe, expect, it } from "vitest";
import { cosine, packInt8, unpackInt8 } from "../src/recall/embed.js";
import { rank, score } from "../src/recall/rank.js";

describe("rank", () => {
  it("multiplies relevance, confidence and clarity and sorts descending", () => {
    const out = rank([
      { id: "a", relevance: 1, confidence: 0.5, clarity: 1 },
      { id: "b", relevance: 0.9, confidence: 0.9, clarity: 0.9 },
      { id: "c", relevance: 0, confidence: 1, clarity: 1 },
    ]);
    expect(out.map((r) => r.item.id)).toEqual(["b", "a"]);
    expect(out[0]!.score).toBeCloseTo(0.729);
  });
  it("clamps out-of-range inputs", () => {
    expect(score({ id: "x", relevance: 2, confidence: -1, clarity: 1 })).toBe(0);
    expect(score({ id: "x", relevance: 2, confidence: 1, clarity: 1 })).toBe(1);
  });
  it("respects the limit and breaks ties by id", () => {
    const out = rank([{ id: "b", relevance: 1, confidence: 1, clarity: 1 }, { id: "a", relevance: 1, confidence: 1, clarity: 1 }], 1);
    expect(out.map((r) => r.item.id)).toEqual(["a"]);
  });
});

describe("int8 packing", () => {
  it("round-trips within quantisation error and preserves cosine", () => {
    const v = new Float32Array(512).map((_, i) => Math.sin(i / 7) * 0.3);
    const { data, scale } = packInt8(v);
    expect(data.length).toBe(512);
    const back = unpackInt8(data, scale);
    for (let i = 0; i < v.length; i++) expect(Math.abs(back[i]! - v[i]!)).toBeLessThanOrEqual(scale / 2 + 1e-6);
    expect(cosine(v, back)).toBeGreaterThan(0.999);
  });
  it("handles the zero vector", () => {
    const { data, scale } = packInt8([0, 0, 0]);
    expect(Array.from(data)).toEqual([0, 0, 0]);
    expect(scale).toBe(1);
  });
});
