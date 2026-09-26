import { describe, expect, it, vi } from "vitest";
import type { WsEvent } from "@cortex/schema";
import { createReplay, parseEventLog, schedule } from "./replay";

function ev(id: string, secondsFromStart: number, room = "Housing"): WsEvent {
  const ts = new Date(Date.UTC(2026, 8, 26, 12, 0, secondsFromStart)).toISOString();
  return { id, day: 2, ts, condition: "cortex", type: "belief.forgotten", payload: { belief_id: id, room: room as "Housing" } };
}

describe("parseEventLog", () => {
  it("keeps valid lines, drops junk, sorts by time", () => {
    const lines = [JSON.stringify(ev("b", 5)), "not json", JSON.stringify({ type: "nope" }), "", JSON.stringify(ev("a", 1))];
    const { events, dropped } = parseEventLog(lines.join("\n"));
    expect(events.map((e) => e.id)).toEqual(["a", "b"]);
    expect(dropped).toBe(2);
  });
});

describe("schedule", () => {
  it("compresses gaps by speed and clamps to the min and max", () => {
    const events = [ev("a", 0), ev("b", 4), ev("c", 4.1), ev("d", 60)];
    expect(schedule(events, { speed: 4, minGapMs: 250, maxGapMs: 2500 })).toEqual([0, 1000, 250, 2500]);
  });
});

describe("createReplay", () => {
  it("emits every event in order on the schedule and stops cleanly", () => {
    vi.useFakeTimers();
    const events = [ev("a", 0), ev("b", 4), ev("c", 8)];
    const seen: string[] = [];
    const replay = createReplay(events, (e) => seen.push(e.id), { speed: 4 });
    expect(replay.total).toBe(3);
    replay.start();
    vi.advanceTimersByTime(0);
    expect(seen).toEqual(["a"]);
    vi.advanceTimersByTime(1000);
    expect(seen).toEqual(["a", "b"]);
    expect(replay.running).toBe(true);
    replay.stop();
    vi.advanceTimersByTime(5000);
    expect(seen).toEqual(["a", "b"]);
    expect(replay.running).toBe(false);
    vi.useRealTimers();
  });
});
