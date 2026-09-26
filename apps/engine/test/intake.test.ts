import sharp from "sharp";
import { beforeAll, describe, expect, it } from "vitest";
import {
  Capture,
  CaptureState,
  CONDITIONS,
  Episode,
  ImageLevel,
  LEVELS,
  type IngestCaptureMeta,
} from "@cortex/schema";
import { emptyMemory } from "../src/db/memory-data.js";
import { fixtureStore } from "../src/db/memory-store.js";
import { advanceMemory } from "../src/forgetting/sweep.js";
import { createIntake, MAX_CAPTURE_BYTES } from "../src/ingest/intake.js";

const meta = (overrides: Partial<IngestCaptureMeta> = {}): IngestCaptureMeta => ({
  episode_id: "maya-day-1",
  day: 1,
  actor: "maya",
  app: "mockloft",
  url: "http://mock.test/listing/one",
  title: "First apartment",
  action: { type: "load" },
  page_text: "A quiet apartment with laundry",
  ...overrides,
});

let png: Buffer;
beforeAll(async () => {
  png = await sharp({
    create: { width: 64, height: 40, channels: 3, background: "#98b2a4" },
  }).png().toBuffer();
});

describe("capture intake", () => {
  it("stores WebP levels and all condition ledgers while retaining extraction hints", async () => {
    const store = fixtureStore();
    const listing = {
      listing_id: "one",
      attrs: { price: 2500, floor: 2, elevator: false, laundry: true },
    };
    const result = await createIntake(store).ingest(png, meta({ listing }));
    expect(result).toMatchObject({ stored: true, phash: expect.stringMatching(/^[0-9a-f]{16}$/) });
    const data = await store.run(false, (d) => d);
    expect(data.captures).toHaveLength(1);
    expect(Capture.parse(data.captures[0])).toMatchObject({
      _id: result.capture_id,
      page_text: meta().page_text,
      listing,
      extracted: false,
      belief_ids: [],
    });
    expect(data.episodes).toHaveLength(1);
    expect(Episode.parse(data.episodes[0])).toMatchObject({
      _id: meta().episode_id,
      day: 1,
      capture_count: 1,
    });
    expect(data.levels.map((level) => level.level)).toEqual(LEVELS);
    expect(data.levels.map((level) => [level.width, level.height])).toEqual([
      [64, 40], [32, 20], [16, 10], [8, 5],
    ]);
    for (const level of data.levels) {
      expect(ImageLevel.safeParse(level).success).toBe(true);
      expect(level.capture_id).toBe(result.capture_id);
      expect(level.data).toBeInstanceOf(Uint8Array);
      const bytes = Buffer.from(level.data as Uint8Array);
      expect(level.bytes).toBe(bytes.byteLength);
      expect((await sharp(bytes).metadata()).format).toBe("webp");
    }
    expect(data.captures[0]!.l0_bytes).toBe(data.levels[0]!.bytes);
    expect(data.captureStates.map((state) => state.condition)).toEqual(CONDITIONS);
    for (const state of data.captureStates) {
      expect(CaptureState.safeParse(state).success).toBe(true);
      expect(state).toMatchObject({
        capture_id: result.capture_id,
        alive_levels: [...LEVELS],
        ceiling: "L0",
        clarity: 1,
        recalls: 0,
        last_recall_day: 1,
      });
    }
    expect(data.beliefs).toEqual([]);
    expect(data.decisions).toEqual([]);
    expect(data.stats).toHaveLength(CONDITIONS.length);
    for (const stat of data.stats) {
      expect(stat.image_bytes).toBe(data.levels.reduce((sum, level) => sum + level.bytes, 0));
      expect(stat.captures_alive).toBe(1);
    }
  });

  it("accepts WebP input and skips an identical retry without incrementing counts", async () => {
    const store = fixtureStore();
    const intake = createIntake(store);
    const webp = await sharp(png).webp().toBuffer();
    const first = await intake.ingest(webp, meta());
    const before = await store.run(false, (d) => d);
    expect(await intake.ingest(webp, meta())).toEqual({ ...first, stored: false });
    expect(await store.run(false, (d) => d)).toEqual(before);
  });

  it("preserves distinct actions, URLs, page text and listing metadata despite identical pixels", async () => {
    const store = fixtureStore();
    const intake = createIntake(store);
    const variants = [
      meta(),
      meta({ action: { type: "click", text: "Reject" } }),
      meta({ action: { type: "submit", text: "Send message" } }),
      meta({ url: "http://mock.test/listing/two" }),
      meta({ page_text: "Different accessible text" }),
      meta({ listing: { listing_id: "two", attrs: { price: 2600 } } }),
      meta({ listing: { listing_id: "two", attrs: { price: 2700 } } }),
    ];
    const ids = [];
    for (const input of variants) {
      const result = await intake.ingest(png, input);
      expect(result.stored).toBe(true);
      ids.push(result.capture_id);
    }
    expect(new Set(ids).size).toBe(variants.length);
    expect(await store.run(false, (d) => d.episodes[0]!.capture_count)).toBe(variants.length);
  });

  it("deduplicates only against the latest capture in the same episode", async () => {
    const store = fixtureStore();
    const intake = createIntake(store);
    const first = await intake.ingest(png, meta());
    await intake.ingest(png, meta({ episode_id: "other-episode" }));
    expect(await intake.ingest(png, meta())).toEqual({ ...first, stored: false });
    await intake.ingest(png, meta({ url: "http://mock.test/listing/two" }));
    expect((await intake.ingest(png, meta())).stored).toBe(true);
    const data = await store.run(false, (d) => d);
    expect(data.captures).toHaveLength(4);
    expect(data.episodes.map((episode) => episode.capture_count)).toEqual([3, 1]);
  });

  it("allows transitions between apps inside an episode", async () => {
    const store = fixtureStore();
    const intake = createIntake(store);
    await intake.ingest(png, meta());
    expect((await intake.ingest(png, meta({ app: "landlord_chat" }))).stored).toBe(true);
    expect(await store.run(false, (d) => d.episodes[0]!.capture_count)).toBe(2);
  });

  it("advances forgetting before insertion and starts new captures with every level alive", async () => {
    const store = fixtureStore();
    const intake = createIntake(store);
    const first = await intake.ingest(png, meta());
    const next = await intake.ingest(png, meta({ day: 4, episode_id: "maya-day-4" }));
    const data = await store.run(false, (d) => d);
    expect(data.day).toBe(4);
    expect(data.captureStates.find((state) => state.capture_id === first.capture_id && state.condition === "cortex")!.alive_levels).not.toContain("L0");
    for (const state of data.captureStates.filter((state) => state.capture_id === next.capture_id)) {
      expect(state.alive_levels).toEqual(LEVELS);
      expect(state.last_recall_day).toBe(4);
    }
  });

  it("rejects stale days and episode actor/day mismatches without mutations", async () => {
    const store = fixtureStore();
    const intake = createIntake(store);
    await intake.ingest(png, meta());
    const before = await store.run(false, (d) => d);
    await expect(intake.ingest(png, meta({ actor: "agent" }))).rejects.toThrow("match its episode");
    await expect(intake.ingest(png, meta({ day: 2 }))).rejects.toThrow("match its episode");
    expect(await store.run(false, (d) => d)).toEqual(before);
    await store.run(true, (d) => advanceMemory(d, 3));
    const advanced = await store.run(false, (d) => d);
    await expect(intake.ingest(png, meta())).rejects.toThrow("precede");
    expect(await store.run(false, (d) => d)).toEqual(advanced);
  });

  it("rejects captures in ended episodes even when the screenshot would deduplicate", async () => {
    const store = fixtureStore();
    const intake = createIntake(store);
    await intake.ingest(png, meta());
    await store.run(true, (d) => { d.episodes[0]!.ended_at = new Date().toISOString(); });
    const before = await store.run(false, (d) => d);
    await expect(intake.ingest(png, meta())).rejects.toThrow("ended episode");
    expect(await store.run(false, (d) => d)).toEqual(before);
  });

  it("validates metadata before decoding or writing", async () => {
    const store = fixtureStore();
    const intake = createIntake(store);
    await expect(intake.ingest(png, meta({ day: -1 }))).rejects.toThrow();
    await expect(intake.ingest(png, meta({ episode_id: "  " }))).rejects.toThrow("episode_id");
    expect(await store.run(false, (d) => d)).toEqual(emptyMemory());
  });

  it("rejects malformed, unsupported and oversized images without writing", async () => {
    const store = fixtureStore();
    const intake = createIntake(store);
    const jpeg = await sharp(png).jpeg().toBuffer();
    for (const input of [Buffer.alloc(0), Buffer.from("invalid image"), jpeg, Buffer.alloc(MAX_CAPTURE_BYTES + 1)])
      await expect(intake.ingest(input, meta())).rejects.toBeInstanceOf(RangeError);
    // A tiny compressed screenshot can still expand beyond the pixel budget.
    const tooManyPixels = await sharp({
      create: { width: 4001, height: 4000, channels: 3, background: "black" },
    }).png().toBuffer();
    await expect(intake.ingest(tooManyPixels, meta())).rejects.toThrow("16 million pixels");
    expect(await store.run(false, (d) => d)).toEqual(emptyMemory());
  });
});
