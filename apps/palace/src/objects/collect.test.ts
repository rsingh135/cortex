import { describe, expect, it } from "vitest";
import { generateFixture } from "@/lib/fixtures/generate";
import { computeLayout } from "@/lib/layout";
import { anchorFor, beliefOpacity, beliefSink, isGold } from "./anchors";
import { collectObjects } from "./collect";
import { pulseProgress, pulseScale, sharpenAmount } from "./pulse";
import { buildThreadSegments } from "./threadSegments";

const snapshot = generateFixture(42, 24);
const layout = computeLayout(snapshot);

describe("collectObjects", () => {
  it("renders every placement exactly once with the right component", () => {
    const objects = collectObjects(snapshot, layout);
    const total = objects.beliefs.length + objects.paintings.length + objects.forgotten.length + objects.procedures.length + objects.archived.length;
    expect(total).toBe(layout.placements.size);
    expect(objects.pedestals.length).toBe(objects.beliefs.length);
    expect(objects.beliefs.length).toBeGreaterThan(50);
    expect(objects.paintings.length + objects.forgotten.length).toBeGreaterThan(20);
    expect(objects.procedures.length).toBe(snapshot.procedures.length);
    expect(objects.archived.length).toBeGreaterThan(0);
    const gold = objects.pedestals.filter((p) => p.gold);
    expect(gold.length).toBeGreaterThan(0);
  });

  it("marks pinned and voice/manual beliefs gold", () => {
    expect(isGold({ pinned: true, source: "screen" })).toBe(true);
    expect(isGold({ pinned: false, source: "voice" })).toBe(true);
    expect(isGold({ pinned: false, source: "manual" })).toBe(true);
    expect(isGold({ pinned: false, source: "screen" })).toBe(false);
  });
});

describe("threads", () => {
  it("builds paired points and never crosses rooms", () => {
    const segments = buildThreadSegments(snapshot, layout);
    for (const bucket of [segments.evidence, segments.solid, segments.dashed]) expect(bucket.length % 2).toBe(0);
    expect(segments.evidence.length).toBeGreaterThan(0);
    expect(segments.dashed.length).toBeGreaterThan(0);
    for (const p of layout.placements.values()) {
      const a = anchorFor(p);
      expect(a[1]).toBeGreaterThan(0);
    }
  });
});

describe("visual mapping math", () => {
  it("maps confidence to opacity and sink", () => {
    expect(beliefOpacity(0)).toBeCloseTo(0.35);
    expect(beliefOpacity(1)).toBeCloseTo(1);
    expect(beliefSink(0)).toBeCloseTo(0.1);
    expect(beliefSink(0.5)).toBe(0);
    expect(beliefSink(1)).toBe(0);
  });

  it("pulses 1 -> 1.25 -> 1 over 600 ms and sharpens paintings after a recall", () => {
    expect(pulseProgress(0, 1000)).toBeNull();
    expect(pulseProgress(1000, 1300)).toBeCloseTo(0.5);
    expect(pulseProgress(1000, 1600)).toBeNull();
    expect(pulseScale(0)).toBeCloseTo(1);
    expect(pulseScale(0.5)).toBeCloseTo(1.25);
    expect(pulseScale(1)).toBeCloseTo(1);
    expect(sharpenAmount(0, 5000, 900, 1200)).toBe(0);
    expect(sharpenAmount(1000, 1500, 900, 1200)).toBe(1);
    expect(sharpenAmount(1000, 2500, 900, 1200)).toBeCloseTo(0.5);
    expect(sharpenAmount(1000, 4000, 900, 1200)).toBe(0);
  });
});
