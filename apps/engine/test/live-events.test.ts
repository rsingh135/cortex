import { describe, expect, it } from "vitest";
import { translate, type Lookup } from "../src/live/events.js";

const ctx = { id: "ev1", day: 24, ts: "2026-09-26T00:00:00.000Z" };
const lookup: Lookup = {
  levelIndex: (id) => (id === "lvl-1" ? { capture_id: "cap-1", level: "L0", bytes: 150000 } : null),
  captureState: () => ({ ceiling: "L1" }),
  beliefConfidence: () => 0.5,
};

describe("change stream translation", () => {
  it("maps a belief insert to belief.created with confidence from c0", () => {
    const out = translate(
      {
        operationType: "insert",
        ns: { coll: "beliefs" },
        documentKey: { _id: "b1" },
        fullDocument: {
          _id: "b1",
          triple: { s: "maya", p: "requires", o: "laundry" },
          text: "Maya needs laundry",
          kind: "preference",
          room: "Housing",
          source: "learner",
          inferred: false,
          pinned: false,
          c0: 0.8,
          evidence: [],
          created_day: 5,
          history: [],
          embedding: new Uint8Array(4),
        },
      },
      ctx,
      lookup,
    );
    expect("event" in out && out.event.type).toBe("belief.created");
    if ("event" in out && out.event.type === "belief.created") {
      expect(out.event.payload.confidence).toBe(0.8);
      expect("embedding" in out.event.payload).toBe(false);
    }
  });
  it("maps an image_levels delete to level.deleted via the level index", () => {
    const out = translate({ operationType: "delete", ns: { coll: "image_levels" }, documentKey: { _id: "lvl-1" } }, ctx, lookup);
    expect("event" in out && out.event.type === "level.deleted" && out.event.payload).toEqual({ capture_id: "cap-1", levels: ["L0"], ceiling: "L1", bytes_freed: 150000 });
  });
  it("skips unknown level ids and unrelated collections", () => {
    expect(translate({ operationType: "delete", ns: { coll: "image_levels" }, documentKey: { _id: "nope" } }, ctx, lookup)).toHaveProperty("skip");
    expect(translate({ operationType: "insert", ns: { coll: "listings" }, documentKey: { _id: "x" }, fullDocument: {} }, ctx, lookup)).toHaveProperty("skip");
  });
  it("maps a belief_state recall update to belief.recalled", () => {
    const out = translate(
      {
        operationType: "update",
        ns: { coll: "belief_state" },
        documentKey: { _id: "bs1" },
        fullDocument: { _id: "bs1", condition: "cortex", belief_id: "b1", confidence: 0.8, recalls: 2, last_recall_day: 24, status: "active", superseded_by: null },
        updateDescription: { updatedFields: { recalls: 2, last_recall_day: 24 } },
      },
      ctx,
      lookup,
    );
    expect("event" in out && out.event.type).toBe("belief.recalled");
  });
});
