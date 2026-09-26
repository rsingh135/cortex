import { WS_EVENT_TYPES, WsEvent, type WsEventType } from "@cortex/schema";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { FIXTURE_IDS, generateFixture } from "./fixtures/generate";
import { usePalaceStore } from "./store";

const base = { id: "evt_1", day: 24, ts: "2026-09-26T00:00:00.000Z", condition: "cortex" as const };

function sampleEvents(): Record<WsEventType, WsEvent> {
  const s = generateFixture(42);
  const belief = s.beliefs.find((b) => b.id === FIXTURE_IDS.budgetPreference)!;
  const capture = s.captures.find((c) => c.aliveLevels.length > 1)!;
  const procedure = s.procedures[0];
  return {
    "capture.created": { ...base, type: "capture.created", payload: { _id: "cap_new", episode_id: "ep_1", day: 24, ts: base.ts, actor: "maya", app: "inbox", url: "https://inbox.local/x", title: "Inbox — new", action: { type: "load" }, phash: "abc", extracted: false, belief_ids: [], l0_bytes: 150000 } },
    "capture.recalled": { ...base, type: "capture.recalled", payload: { capture_id: capture.id, clarity: 1, ceiling: capture.ceiling, recalls: capture.recalls + 1 } },
    "level.deleted": { ...base, type: "level.deleted", payload: { capture_id: capture.id, levels: [capture.aliveLevels[0]], ceiling: capture.aliveLevels[1], bytes_freed: 1000 } },
    "belief.created": { ...base, type: "belief.created", payload: { _id: "blf_new", triple: { s: "maya", p: "prefers", o: "quiet" }, text: "Prefers a quiet street", kind: "preference", room: "Housing", source: "voice", inferred: false, pinned: false, c0: 0.9, evidence: [], created_day: 24, history: [], confidence: 0.9 } },
    "belief.reinforced": { ...base, type: "belief.reinforced", payload: { belief_id: belief.id, confidence: 0.97, evidence_added: [capture.id] } },
    "belief.recalled": { ...base, type: "belief.recalled", payload: { belief_id: belief.id, confidence: 0.95, recalls: belief.recalls + 1, reason: "test" } },
    "belief.updated": { ...base, type: "belief.updated", payload: { belief_id: belief.id, text: "Budget: at most $2,900/month", confidence: 0.9, by: "maya" } },
    "belief.superseded": { ...base, type: "belief.superseded", payload: { belief_id: belief.id, superseded_by: "blf_new" } },
    "belief.tombstoned": { ...base, type: "belief.tombstoned", payload: { belief_id: FIXTURE_IDS.stylePreference, captures_deleted: [] } },
    "belief.forgotten": { ...base, type: "belief.forgotten", payload: { belief_id: FIXTURE_IDS.trainPreference, room: "Housing" } },
    "edge.created": { ...base, type: "edge.created", payload: { _id: "edg_new", from: FIXTURE_IDS.laundryPreference, to: capture.id, type: "evidence", weight: 1 } },
    "procedure.created": { ...base, type: "procedure.created", payload: { _id: "prc_new", name: "weekly_review", description: "d", room: "Work", status: "active", steps: [{ n: 1, do: "open_calendar" }], decision_attributes: [], learned_from: [], runs: 0, cracked_by: [] } },
    "procedure.cracked": { ...base, type: "procedure.cracked", payload: { procedure_id: procedure.id, by_belief_id: FIXTURE_IDS.petsInferred, attr: "pets" } },
    "procedure.healed": { ...base, type: "procedure.healed", payload: { procedure_id: procedure.id, run_id: "run_1" } },
    "procedure.step": { ...base, type: "procedure.step", payload: { procedure_id: procedure.id, run_id: "run_1", step: 2, do: "filter_listings", because: [belief.id] } },
    "clock.advanced": { ...base, type: "clock.advanced", payload: { from_day: 24, to_day: 25, levels_deleted: 0, bytes_freed: 0, captures_forgotten: 0, beliefs_decayed: 0, beliefs_forgotten: 0, rooms_dimmed: [] } },
    "agent.drafts": { ...base, type: "agent.drafts", payload: { run_id: "run_1", drafts: [{ draft_id: "drf_1", listing_id: "listing:214", listing_title: "2BR in Ridgewood", to: "landlord@example.com", text: "Hi — is this still available?", because: [belief.id] }] } },
    "agent.draft_sent": { ...base, type: "agent.draft_sent", payload: { draft_id: "drf_1", message_id: "msg_1", because: [belief.id] } },
    "voice.received": { ...base, type: "voice.received", payload: { voice_note_id: "vn_1", transcript: "I'm getting a dog" } },
    snapshot: {
      ...base,
      day: 3,
      type: "snapshot",
      payload: {
        beliefs: [{ _id: "b1", triple: { s: "maya", p: "lives_in", o: "place:brooklyn" }, text: "Lives in Brooklyn", kind: "fact", room: "Housing", source: "screen", inferred: false, pinned: false, c0: 0.3, evidence: ["c1"], created_day: 2, history: [], confidence: 0.28, status: "active" }],
        captures: [{ _id: "c1", episode_id: "ep", day: 2, ts: base.ts, actor: "maya", app: "mockloft", url: "u", title: "t", action: { type: "load" }, phash: "p", extracted: true, belief_ids: ["b1"], l0_bytes: 150000, alive_levels: ["L1", "L2", "L3"], ceiling: "L1", clarity: 0.7 }],
        procedures: [],
        edges: [{ _id: "e1", from: "b1", to: "c1", type: "evidence", weight: 1 }],
      },
    },
  };
}

describe("palace store", () => {
  beforeEach(() => {
    usePalaceStore.getState().connect();
    usePalaceStore.getState().setPlaying(false);
  });
  afterEach(() => usePalaceStore.getState().disconnect());

  it("loads the fixture in fixture mode", () => {
    const s = usePalaceStore.getState();
    expect(s.mode).toBe("fixture");
    expect(s.connection).toBe("open");
    expect(s.snapshot.day).toBe(24);
    expect(s.layout.placements.size).toBeGreaterThan(100);
  });

  it("handles every event type without throwing and records it", () => {
    const events = sampleEvents();
    for (const type of WS_EVENT_TYPES) {
      const e = events[type];
      expect(WsEvent.safeParse(e).success, type).toBe(true);
      expect(() => usePalaceStore.getState().applyEvent(e), type).not.toThrow();
      expect(usePalaceStore.getState().recentEvents[0]).toBe(e);
    }
    expect(usePalaceStore.getState().recentEvents.length).toBeLessThanOrEqual(50);
  });

  it("snapshot event replaces state wholesale", () => {
    const events = sampleEvents();
    usePalaceStore.getState().applyEvent(events.snapshot);
    const s = usePalaceStore.getState();
    expect(s.snapshot.day).toBe(3);
    expect(s.snapshot.beliefs.map((b) => b.id)).toEqual(["b1"]);
    expect(s.snapshot.captures[0].aliveLevels).toEqual(["L1", "L2", "L3"]);
    expect(s.snapshot.bytes.keepAll).toBe(150000 + 37500 + 9375 + 2344);
    expect(s.layout.placements.get("b1")?.kind).toBe("belief");
    expect(s.layout.placements.get("c1")?.kind).toBe("painting");
  });

  it("recall pulses and reinforcement update the model", () => {
    const events = sampleEvents();
    usePalaceStore.getState().applyEvent(events["belief.recalled"]);
    const s = usePalaceStore.getState();
    expect(s.pulses[FIXTURE_IDS.budgetPreference]).toBeGreaterThan(0);
    const b = s.snapshot.beliefs.find((x) => x.id === FIXTURE_IDS.budgetPreference)!;
    expect(b.lastRecallDay).toBe(24);
    expect(b.recallDays).toContain(24);
  });

  it("setDay(30) shrinks cortex bytes, keeps keepAll, and emits synthetic level.deleted events", () => {
    const before = usePalaceStore.getState().snapshot.bytes;
    usePalaceStore.getState().setDay(30);
    const s = usePalaceStore.getState();
    expect(s.snapshot.day).toBe(30);
    expect(s.snapshot.bytes.cortex).toBeLessThan(before.cortex);
    expect(s.snapshot.bytes.keepAll).toBe(before.keepAll);
    expect(s.recentEvents.some((e) => e.type === "level.deleted")).toBe(true);
    expect(s.recentEvents[0].type).toBe("clock.advanced");
    for (const e of s.recentEvents) expect(WsEvent.safeParse(e).success).toBe(true);
    const pinned = s.snapshot.beliefs.find((b) => b.id === FIXTURE_IDS.leasePinned)!;
    expect(pinned.confidence).toBe(1);
  });

  it("setDay is reversible in fixture mode", () => {
    const start = usePalaceStore.getState().snapshot;
    usePalaceStore.getState().setDay(30);
    usePalaceStore.getState().setDay(24);
    const back = usePalaceStore.getState().snapshot;
    expect(back.bytes).toEqual(start.bytes);
    expect(back.captures.map((c) => c.aliveLevels)).toEqual(start.captures.map((c) => c.aliveLevels));
  });

  it("edits and deletes beliefs locally", () => {
    usePalaceStore.getState().editBelief(FIXTURE_IDS.budgetPreference, "Budget: at most $3,000/month");
    expect(usePalaceStore.getState().snapshot.beliefs.find((b) => b.id === FIXTURE_IDS.budgetPreference)?.text).toBe("Budget: at most $3,000/month");
    usePalaceStore.getState().select(FIXTURE_IDS.stylePreference);
    usePalaceStore.getState().deleteBelief(FIXTURE_IDS.stylePreference);
    const s = usePalaceStore.getState();
    expect(s.snapshot.beliefs.find((b) => b.id === FIXTURE_IDS.stylePreference)?.status).toBe("tombstoned");
    expect(s.layout.placements.has(FIXTURE_IDS.stylePreference)).toBe(false);
  });
});
