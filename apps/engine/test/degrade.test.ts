/**
 * End-to-end proof that a screenshot actually degrades: the same capture, served over simulated
 * days, comes back at coarser rungs and fewer bytes under cortex, is gone entirely once every rung
 * expires, and never degrades at all under keep_all. docs/spec.md > Forgetting engine.
 */
import { describe, expect, it } from "vitest";
import sharp from "sharp";
import { LEVELS, type Level } from "@cortex/schema";
import { createApp } from "../src/api/app.js";
import { fixtureStore } from "../src/db/memory-store.js";
import { emptyMemory } from "../src/db/memory-data.js";
import { createIntake } from "../src/ingest/intake.js";
import { advanceMemory } from "../src/forgetting/sweep.js";
import { testImage } from "./helpers.js";

async function ingested() {
  const store = fixtureStore(emptyMemory());
  const intake = createIntake(store);
  const result = await intake.ingest(await testImage(1280, 800, 7), {
    episode_id: "ep_degrade",
    day: 0,
    actor: "maya",
    app: "mockloft",
    url: "https://mockloft.local/listings/214",
    title: "2BR in Ridgewood",
    action: { type: "load" },
  });
  return { store, app: createApp({ fixtureMode: false, memory: store }), capture: result.capture_id };
}

const served = async (
  app: Awaited<ReturnType<typeof ingested>>["app"],
  capture: string,
  condition: string,
) => {
  const res = await app.request(
    `/image/${encodeURIComponent(capture)}?condition=${condition}`,
  );
  if (res.status === 404) return null;
  const bytes = Buffer.from(await res.arrayBuffer());
  const meta = await sharp(bytes).metadata();
  return { bytes: bytes.byteLength, width: meta.width!, height: meta.height! };
};

describe("screenshot degradation over time", () => {
  it("stores all four rungs, each smaller than the last", async () => {
    const { store, capture } = await ingested();
    const levels = await store.run(false, (d) =>
      d.levels
        .filter((l) => l.capture_id === capture)
        .map((l) => ({ level: l.level, width: l.width, bytes: l.bytes })),
    );
    expect(levels.map((l) => l.level).sort()).toEqual([...LEVELS].sort());
    const byLevel = new Map(levels.map((l) => [l.level as Level, l]));
    expect(byLevel.get("L0")!.width).toBe(1280);
    expect(byLevel.get("L1")!.width).toBe(640);
    expect(byLevel.get("L2")!.width).toBe(320);
    expect(byLevel.get("L3")!.width).toBe(160);
    for (const [sharper, coarser] of [
      ["L0", "L1"],
      ["L1", "L2"],
      ["L2", "L3"],
    ] as const)
      expect(byLevel.get(coarser)!.bytes).toBeLessThan(
        byLevel.get(sharper)!.bytes,
      );
  });

  it("serves a coarser, smaller image as the days pass, then 404s when it is forgotten", async () => {
    const { store, app, capture } = await ingested();
    const timeline: { day: number; width: number; bytes: number }[] = [];
    const first = await served(app, capture, "cortex");
    expect(first).not.toBeNull();
    timeline.push({ day: 0, ...first! });

    for (const day of [3, 6, 12, 24, 60]) {
      await store.run(true, (d) => advanceMemory(d, day));
      const now = await served(app, capture, "cortex");
      if (now) timeline.push({ day, ...now });
      else {
        // Every rung has expired: the memory is gone, not merely blurry.
        expect(day).toBeGreaterThan(12);
        expect(timeline.at(-1)!.width).toBeLessThan(timeline[0]!.width);
        return;
      }
    }
    throw new Error(
      `capture never expired: ${JSON.stringify(timeline)}`,
    );
  });

  it("degrades monotonically — never sharpens on its own", async () => {
    const { store, app, capture } = await ingested();
    let previous = (await served(app, capture, "cortex"))!;
    for (const day of [2, 4, 5, 6, 10, 11]) {
      await store.run(true, (d) => advanceMemory(d, day));
      const now = await served(app, capture, "cortex");
      if (!now) break;
      expect(now.width).toBeLessThanOrEqual(previous.width);
      expect(now.bytes).toBeLessThanOrEqual(previous.bytes);
      previous = now;
    }
  });

  it("keep_all never degrades, which is the comparison the chart rests on", async () => {
    const { store, app, capture } = await ingested();
    const before = (await served(app, capture, "keep_all"))!;
    await store.run(true, (d) => advanceMemory(d, 60));
    const after = (await served(app, capture, "keep_all"))!;
    expect(after).toEqual(before);
    expect(after.width).toBe(1280);
    // Meanwhile the same capture under cortex is gone by day 60.
    expect(await served(app, capture, "cortex")).toBeNull();
  });
});
