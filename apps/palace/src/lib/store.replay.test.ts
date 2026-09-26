import { readFileSync } from "node:fs";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { usePalaceStore } from "./store";

const LOG = readFileSync(join(__dirname, "..", "..", "public", "demo", "day2-events.jsonl"), "utf8");
const LOG_LINES = LOG.split("\n").filter((l) => l.trim().length > 0);
const LOG_EVENTS = LOG_LINES.length;
const LOG_CAPTURES = LOG_LINES.filter((l) => l.includes('"type":"capture.created"')).length;

describe("replay mode", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.stubGlobal("fetch", vi.fn(() => Promise.resolve({ ok: true, status: 200, text: () => Promise.resolve(LOG) })));
    usePalaceStore.getState().connect();
    usePalaceStore.getState().setPlaying(false);
  });
  afterEach(() => {
    usePalaceStore.getState().disconnect();
    vi.unstubAllGlobals();
    vi.useRealTimers();
  });

  it("resets to an empty day-2 memory and hangs the bundled screenshots as events play", async () => {
    expect(usePalaceStore.getState().snapshot.day).toBe(24);
    const start = usePalaceStore.getState().startReplay();
    await vi.advanceTimersByTimeAsync(0);
    await start;
    let s = usePalaceStore.getState();
    expect(s.replay.status).toBe("playing");
    expect(s.replay.total).toBe(LOG_EVENTS);
    expect(s.snapshot.day).toBe(2);
    expect(s.snapshot.captures.length).toBeLessThanOrEqual(1);

    await vi.advanceTimersByTimeAsync(20_000);
    s = usePalaceStore.getState();
    expect(s.replay.played).toBeGreaterThan(5);
    expect(s.snapshot.captures[0]?.textureUrl).toMatch(/^\/captures\/.*\.webp$/);
    const belief = s.snapshot.beliefs[0];
    expect(belief).toBeDefined();
    expect(s.pulses[belief!.id]).toBeGreaterThan(0);
    expect(s.layout.placements.get(s.snapshot.captures[0]!.id)?.kind).toBe("painting");

    await vi.advanceTimersByTimeAsync(LOG_EVENTS * 2500);
    s = usePalaceStore.getState();
    expect(s.replay).toEqual({ status: "done", played: LOG_EVENTS, total: LOG_EVENTS });
    expect(s.snapshot.captures).toHaveLength(LOG_CAPTURES);
    expect(s.snapshot.edges.length).toBeGreaterThan(0);
  });

  it("stopReplay halts playback and a later start supersedes it", async () => {
    const first = usePalaceStore.getState().startReplay();
    await vi.advanceTimersByTimeAsync(0);
    await first;
    await vi.advanceTimersByTimeAsync(3000);
    const playedBefore = usePalaceStore.getState().replay.played;
    usePalaceStore.getState().stopReplay();
    expect(usePalaceStore.getState().replay.status).toBe("idle");
    await vi.advanceTimersByTimeAsync(10_000);
    expect(usePalaceStore.getState().replay.played).toBe(playedBefore);
  });

  it("toasts and stays idle when the log cannot be fetched", async () => {
    vi.stubGlobal("fetch", vi.fn(() => Promise.resolve({ ok: false, status: 404, text: () => Promise.resolve("") })));
    const start = usePalaceStore.getState().startReplay({ url: "/demo/missing.jsonl" });
    await vi.advanceTimersByTimeAsync(0);
    await start;
    const s = usePalaceStore.getState();
    expect(s.replay.status).toBe("idle");
    expect(s.toasts[0]?.text).toMatch(/replay log unavailable/);
    expect(s.snapshot.day).toBe(24);
  });
});
