import { describe, expect, it } from "vitest";
import { Snapshot } from "@cortex/schema";
import { fixtureStore } from "../src/db/memory-store.js";
import { createIntake } from "../src/ingest/intake.js";
import { applyExtraction, previousCaptures } from "../src/extraction/apply.js";
import { createExtractionQueue } from "../src/extraction/queue.js";
import type { Extractor } from "../src/extraction/extract.js";
import type { ExtractionOutput } from "../src/extraction/schema.js";
import { snapshot } from "../src/live/snapshot.js";
import { testImage } from "./helpers.js";

async function seedCapture(store: ReturnType<typeof fixtureStore>, variant = 0, title = "Sunny 1BR in Bushwick") {
  const intake = createIntake(store);
  return intake.ingest(await testImage(400, 300, variant), {
    episode_id: "hunt1-day2",
    day: 2,
    actor: "maya",
    app: "mockloft",
    url: `http://mock/listings/listing:${101 + variant}`,
    title,
    action: { type: "load" },
    page_text: "raw page text to be deleted",
  });
}

const output: ExtractionOutput = {
  beliefs: [
    { s: "maya", p: "viewed", o: "listing:101", text: "Maya viewed a sunny 1BR in Bushwick", kind: "event", room: "Housing" },
    { s: "listing:101", p: "prefers", o: "laundry:in-building", text: "Listing 101 has laundry in the building", kind: "fact", room: "Housing" },
  ],
  listing: { listing_id: "listing:101", price: 2600, neighborhood: "Bushwick", train: "L", floor: 5, elevator: false, laundry: true, pets: false },
};

describe("applyExtraction", () => {
  it("writes beliefs, one state per condition, evidence edges, listing attrs, and deletes page_text", async () => {
    const store = fixtureStore();
    const { capture_id } = await seedCapture(store);
    const result = await store.run(true, (d) => applyExtraction(d, capture_id, output));
    expect(result.inserted).toHaveLength(2);
    expect(result.reinforced).toHaveLength(0);
    await store.run(false, (d) => {
      expect(d.beliefs).toHaveLength(2);
      expect(d.beliefStates).toHaveLength(6);
      expect(d.beliefStates.every((s) => s.confidence === 0.3 && s.status === "active")).toBe(true);
      expect(d.edges.filter((e) => e.type === "evidence" && e.to === capture_id)).toHaveLength(2);
      const capture = d.captures[0]!;
      expect(capture.extracted).toBe(true);
      expect(capture.page_text).toBeUndefined();
      expect(capture.belief_ids).toHaveLength(2);
      expect(capture.listing?.attrs.walkup_floor).toBe(5);
      expect(() => Snapshot.parse(snapshot(d, "cortex"))).not.toThrow();
      expect(snapshot(d, "cortex").payload.beliefs).toHaveLength(2);
    });
  });

  it("consolidates an exact triple: reinforces every condition and appends evidence instead of inserting", async () => {
    const store = fixtureStore();
    const first = await seedCapture(store, 0);
    const second = await seedCapture(store, 1, "Sunny 1BR in Bushwick (again)");
    await store.run(true, (d) => applyExtraction(d, first.capture_id, output));
    const result = await store.run(true, (d) => applyExtraction(d, second.capture_id, { beliefs: [output.beliefs[0]!], listing: null }));
    expect(result.inserted).toHaveLength(0);
    expect(result.reinforced).toHaveLength(1);
    await store.run(false, (d) => {
      expect(d.beliefs).toHaveLength(2);
      const belief = d.beliefs.find((b) => b._id === result.reinforced[0])!;
      expect(belief.evidence).toEqual([first.capture_id, second.capture_id]);
      expect(belief.history.at(-1)?.event).toBe("reinforced");
      for (const s of d.beliefStates.filter((s) => s.belief_id === belief._id)) expect(s.confidence).toBeCloseTo(0.3 + 0.3 * 0.7);
      expect(d.edges.filter((e) => e.from === belief._id)).toHaveLength(2);
    });
  });

  it("describes the previous captures of the episode, newest last", async () => {
    const store = fixtureStore();
    await seedCapture(store, 0, "First");
    await seedCapture(store, 1, "Second");
    const third = await seedCapture(store, 2, "Third");
    await store.run(false, (d) => {
      const capture = d.captures.find((c) => c._id === third.capture_id)!;
      const prev = previousCaptures(d, capture, 3);
      expect(prev).toHaveLength(2);
      expect(prev[0]).toContain("First");
      expect(prev[1]).toContain("Second");
    });
  });
});

describe("extraction queue", () => {
  it("extracts stored captures in the background from the L1 rung and marks them extracted", async () => {
    const store = fixtureStore();
    const seen: number[] = [];
    const extractor: Extractor = {
      async extract(input) {
        seen.push(input.image.byteLength);
        expect(input.url).toContain("listing:");
        return output;
      },
    };
    const done: string[] = [];
    const queue = createExtractionQueue({ store, extractor, concurrency: 2, onDone: (r) => done.push(r.capture_id) });
    const a = await seedCapture(store, 0);
    const b = await seedCapture(store, 1, "Other");
    queue.enqueue(a.capture_id);
    queue.enqueue(b.capture_id);
    queue.enqueue("missing-capture");
    expect(queue.pending).toBeGreaterThan(0);
    await queue.drain();
    expect(queue.pending).toBe(0);
    expect(seen).toHaveLength(2);
    expect(done.sort()).toEqual([a.capture_id, b.capture_id].sort());
    await store.run(false, (d) => {
      expect(d.captures.every((c) => c.extracted)).toBe(true);
      expect(d.beliefs).toHaveLength(2);
    });
  });

  it("reports extractor failures without stalling the queue", async () => {
    const store = fixtureStore();
    const errors: string[] = [];
    const queue = createExtractionQueue({
      store,
      extractor: { extract: async () => { throw new Error("model down"); } },
      onError: (id) => errors.push(id),
    });
    const a = await seedCapture(store);
    queue.enqueue(a.capture_id);
    await queue.drain();
    expect(errors).toEqual([a.capture_id]);
    await store.run(false, (d) => expect(d.captures[0]!.extracted).toBe(false));
  });
});
