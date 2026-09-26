// @vitest-environment happy-dom
/**
 * Live mode: the store opens the WebSocket alongside GET /snapshot and must not lose the frames that
 * arrive before the snapshot has been applied. Runs under happy-dom because `connect()` needs a window.
 */
import type { WsEvent } from "@cortex/schema";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const base = { id: "evt_1", day: 3, ts: "2026-09-26T00:00:00.000Z", condition: "cortex" as const };

const snapshotEvent: WsEvent = {
  ...base,
  type: "snapshot",
  payload: {
    beliefs: [{ _id: "b1", triple: { s: "maya", p: "lives_in", o: "place:brooklyn" }, text: "Lives in Brooklyn", kind: "fact", room: "Housing", source: "screen", inferred: false, pinned: false, c0: 0.3, evidence: ["c1"], created_day: 2, history: [], confidence: 0.28, status: "active" }],
    captures: [{ _id: "c1", episode_id: "ep", day: 2, ts: base.ts, actor: "maya", app: "mockloft", url: "u", title: "t", action: { type: "load" }, phash: "p", extracted: true, belief_ids: ["b1"], l0_bytes: 150000, alive_levels: ["L1", "L2", "L3"], ceiling: "L1", clarity: 0.7 }],
    procedures: [],
    edges: [{ _id: "e1", from: "b1", to: "c1", type: "evidence", weight: 1 }],
  },
};

const earlyBelief: WsEvent = {
  ...base,
  id: "evt_2",
  type: "belief.created",
  payload: { _id: "b_early", triple: { s: "maya", p: "prefers", o: "quiet" }, text: "Prefers a quiet street", kind: "preference", room: "Housing", source: "voice", inferred: false, pinned: false, c0: 0.9, evidence: [], created_day: 3, history: [], confidence: 0.9 },
};

const earlyRecall: WsEvent = { ...base, id: "evt_3", type: "belief.recalled", payload: { belief_id: "b1", confidence: 0.95, recalls: 1, reason: "test" } };

class FakeSocket {
  static instances: FakeSocket[] = [];
  onopen: (() => void) | null = null;
  onclose: (() => void) | null = null;
  onerror: (() => void) | null = null;
  onmessage: ((msg: { data: string }) => void) | null = null;
  closed = false;
  constructor(public readonly url: string) {
    FakeSocket.instances.push(this);
  }
  close(): void {
    this.closed = true;
    this.onclose?.();
  }
  receive(event: WsEvent): void {
    this.onmessage?.({ data: JSON.stringify(event) });
  }
}

let resolveSnapshot: ((json: unknown) => void) | null = null;

async function loadStore() {
  vi.resetModules();
  process.env.NEXT_PUBLIC_LIVE_SERVER_WS_URL = "ws://engine.test/ws";
  process.env.NEXT_PUBLIC_ENGINE_URL = "http://engine.test";
  return import("./store");
}

describe("live connect", () => {
  beforeEach(() => {
    FakeSocket.instances = [];
    resolveSnapshot = null;
    vi.stubGlobal("WebSocket", FakeSocket);
    vi.stubGlobal(
      "fetch",
      vi.fn(
        () =>
          new Promise<{ json(): Promise<unknown> }>((resolve) => {
            resolveSnapshot = (json) => resolve({ json: () => Promise.resolve(json) });
          }),
      ),
    );
  });
  afterEach(() => {
    vi.unstubAllGlobals();
    delete process.env.NEXT_PUBLIC_LIVE_SERVER_WS_URL;
    delete process.env.NEXT_PUBLIC_ENGINE_URL;
  });

  it("replays frames that arrived before the snapshot instead of losing them", async () => {
    const { usePalaceStore } = await loadStore();
    const store = usePalaceStore.getState();
    expect(store.mode).toBe("fixture");
    store.connect();
    expect(usePalaceStore.getState().mode).toBe("live");
    const ws = FakeSocket.instances[0];
    expect(ws).toBeDefined();
    ws.onopen?.();
    expect(usePalaceStore.getState().connection).toBe("open");

    // Two live frames land while GET /snapshot is still in flight.
    ws.receive(earlyBelief);
    ws.receive(earlyRecall);
    expect(usePalaceStore.getState().snapshot.beliefs).toHaveLength(0);

    resolveSnapshot?.(snapshotEvent);
    await vi.waitFor(() => expect(usePalaceStore.getState().snapshot.beliefs.map((b) => b.id).sort()).toEqual(["b1", "b_early"]));
    const s = usePalaceStore.getState();
    expect(s.snapshot.day).toBe(3);
    expect(s.snapshot.beliefs.find((b) => b.id === "b1")?.recalls).toBe(1);
    expect(s.recentEvents.map((e) => e.id)).toEqual(["evt_3", "evt_2", "evt_1"]);

    // After the snapshot, frames apply immediately.
    ws.receive({ ...earlyRecall, id: "evt_4", payload: { ...earlyRecall.payload, recalls: 2 } } as WsEvent);
    expect(usePalaceStore.getState().snapshot.beliefs.find((b) => b.id === "b1")?.recalls).toBe(2);
    usePalaceStore.getState().disconnect();
    expect(ws.closed).toBe(true);
  });

  it("drops a stale snapshot and its held frames after a reconnect", async () => {
    const { usePalaceStore } = await loadStore();
    usePalaceStore.getState().connect();
    const first = FakeSocket.instances[0];
    first.receive(earlyBelief);
    const staleResolve = resolveSnapshot;
    usePalaceStore.getState().connect();
    expect(first.closed).toBe(true);
    expect(FakeSocket.instances).toHaveLength(2);
    staleResolve?.(snapshotEvent);
    await new Promise((r) => setTimeout(r, 0));
    await new Promise((r) => setTimeout(r, 0));
    expect(usePalaceStore.getState().snapshot.beliefs).toHaveLength(0);
    usePalaceStore.getState().disconnect();
  });
});
