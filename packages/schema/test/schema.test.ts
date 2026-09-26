import { describe, expect, it } from "vitest";
import { Belief, CaptureState, Listing } from "../src/collections.js";
import { WsEvent } from "../src/events.js";
import { RecallRequest } from "../src/api.js";

describe("collection schemas", () => {
  it("accepts a well-formed belief", () => {
    const b = Belief.parse({
      _id: "01J",
      triple: { s: "maya", p: "requires", o: "laundry" },
      text: "Maya needs laundry in the unit or building",
      kind: "preference",
      room: "Housing",
      source: "learner",
      inferred: false,
      pinned: false,
      c0: 0.8,
      evidence: ["01C"],
      rule: { attr: "laundry", op: "==", value: true, then: "skip" },
      created_day: 5,
      history: [],
    });
    expect(b.rule?.support).toEqual([]);
  });
  it("rejects an unknown predicate or room", () => {
    expect(() =>
      Belief.parse({
        _id: "x",
        triple: { s: "maya", p: "likes", o: "cats" },
        text: "",
        kind: "fact",
        room: "Kitchen",
        source: "screen",
        inferred: false,
        pinned: false,
        c0: 0.3,
        evidence: [],
        created_day: 1,
        history: [],
      }),
    ).toThrow();
  });
  it("capture_state allows a null ceiling for forgotten captures", () => {
    const s = CaptureState.parse({ _id: "s", condition: "cortex", capture_id: "c", alive_levels: [], ceiling: null, clarity: 0, recalls: 0, last_recall_day: 2 });
    expect(s.ceiling).toBeNull();
  });
  it("listing flattens the attribute shape", () => {
    const l = Listing.parse({
      _id: "listing:214",
      hunt: "hunt1",
      title: "Sunny 1BR",
      price: 2600,
      neighborhood: "Bushwick",
      train: "L",
      floor: 5,
      elevator: false,
      laundry: true,
      pets: false,
      photos: [],
      landlord: "Dana",
      description: "",
      trap: "walkup",
    });
    expect(l.floor).toBe(5);
  });
});

describe("ws events", () => {
  it("parses a clock.advanced envelope and defaults condition to cortex", () => {
    const e = WsEvent.parse({
      id: "e1",
      day: 24,
      ts: new Date().toISOString(),
      type: "clock.advanced",
      payload: { from_day: 5, to_day: 24, levels_deleted: 812, bytes_freed: 40_000_000, captures_forgotten: 140, beliefs_decayed: 60, beliefs_forgotten: 12, rooms_dimmed: ["Work", "Misc"] },
    });
    expect(e.condition).toBe("cortex");
  });
  it("rejects an unknown event type", () => {
    expect(() => WsEvent.parse({ id: "e", day: 1, ts: new Date().toISOString(), type: "belief.exploded", payload: {} })).toThrow();
  });
});

describe("api", () => {
  it("recall requests default to a real (non-dry-run) recall", () => {
    const r = RecallRequest.parse({ query: "budget", by: "agent", reason: "skip listing 311" });
    expect(r.dry_run).toBe(false);
    expect(r.condition).toBe("cortex");
    expect(r.limit).toBe(10);
  });
});
