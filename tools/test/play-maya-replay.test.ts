import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { chromium } from "playwright";
import type { ScriptStep } from "@cortex/persona";
import { engineSink, playMaya } from "../play-maya";

const step = (episode: string, day: number, action: "open" | "dwell" = "open"): ScriptStep => ({
  episode, day, action, app: "mockloft", target: `/listings/${episode}`, pause_s: 0,
});
const steps = [step("first", 1), step("first", 1, "dwell"), step("second", 1), step("third", 2)];
let events: string[];
let close: ReturnType<typeof vi.fn>;

beforeEach(() => {
  events = [];
  close = vi.fn().mockResolvedValue(undefined);
  let url = "http://mock.test/";
  let evaluations = 0;
  const page = {
    goto: vi.fn(async (next: string) => { url = next; }),
    url: () => url,
    title: async () => "Apartment",
    evaluate: vi.fn(async () => evaluations++ % 2 === 0 ? {} : "Visible page text"),
    screenshot: vi.fn(async () => Buffer.from("browser screenshot")),
  };
  const context = {
    newPage: async () => page,
    addCookies: vi.fn(async (cookies: Array<{ value: string }>) => { events.push(`day:${cookies[0]!.value}`); }),
  };
  vi.spyOn(chromium, "launch").mockResolvedValue({ newContext: async () => context, close } as never);
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

const run = (sink: ReturnType<typeof engineSink>, selectedDays?: number[]) => playMaya({
  mockworldUrl: "http://mock.test", speed: 0, token: "test-token", steps, sink,
  ...(selectedDays ? { days: selectedDays } : {}),
});

describe("play-maya engine replay", () => {
  it("ends each episode once after its final capture, before the next episode or day", async () => {
    let captures = 0;
    vi.stubGlobal("fetch", vi.fn(async (url: string, init: RequestInit) => {
      expect(init.headers).toEqual({ "x-cortex-write-token": "test-token" });
      if (url.endsWith("/ingest/capture")) {
        const meta = JSON.parse((init.body as FormData).get("meta") as string) as { episode_id: string };
        events.push(`capture:${meta.episode_id}`);
        captures += 1;
        return Response.json({ capture_id: `capture-${captures}`, stored: captures !== 2, phash: "0123456789abcdef" });
      }
      const episodeId = /\/episodes\/(.+)\/end$/.exec(url)![1]!;
      events.push(`end:${episodeId}`);
      return Response.json({ episode_id: episodeId, summary: "Recorded activity", summary_belief_id: `summary-${episodeId}` });
    }));

    expect(await run(engineSink("http://engine.test/", "test-token"))).toBe(4);
    expect(events).toEqual([
      "day:1", "capture:first", "capture:first", "end:first",
      "capture:second", "end:second", "day:2", "capture:third", "end:third",
    ]);
    expect(close).toHaveBeenCalledOnce();
  });

  it("closes only episodes included by the day filter", async () => {
    const endEpisode = vi.fn(async (id: string) => { events.push(`end:${id}`); });
    const sink = {
      count: 0,
      async put() { this.count += 1; },
      endEpisode,
    };
    expect(await run(sink, [2])).toBe(1);
    expect(events).toEqual(["day:2", "end:third"]);
  });

  it("keeps recording sinks without an episode hook compatible", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    const sink = { count: 0, async put() { this.count += 1; } };
    expect(await run(sink)).toBe(4);
    expect(fetchMock).not.toHaveBeenCalled();
    expect(close).toHaveBeenCalledOnce();
  });

  it("stops before later captures when episode completion fails and closes the browser", async () => {
    vi.stubGlobal("fetch", vi.fn(async (url: string, init: RequestInit) => {
      if (url.endsWith("/ingest/capture")) {
        const meta = JSON.parse((init.body as FormData).get("meta") as string) as { episode_id: string };
        events.push(`capture:${meta.episode_id}`);
        return Response.json({ capture_id: "capture", stored: true, phash: "0123456789abcdef" });
      }
      return new Response("summary unavailable", { status: 503 });
    }));
    await expect(run(engineSink("http://engine.test", "test-token"))).rejects.toThrow("end episode first failed 503");
    expect(events).toEqual(["day:1", "capture:first", "capture:first"]);
    expect(close).toHaveBeenCalledOnce();
  });

  it("validates episode responses and URL-encodes the supplied episode id", async () => {
    const sink = engineSink("http://engine.test", "test-token");
    const fetchMock = vi.fn().mockResolvedValue(Response.json({ episode_id: "wrong", summary: "Activity" }));
    vi.stubGlobal("fetch", fetchMock);
    await expect(sink.endEpisode!("a/b")).rejects.toThrow("different episode ID");
    expect(fetchMock.mock.calls[0]![0]).toBe("http://engine.test/episodes/a%2Fb/end");
    fetchMock.mockResolvedValueOnce(Response.json({ episode_id: "a/b" }));
    await expect(sink.endEpisode!("a/b")).rejects.toThrow();
    fetchMock.mockResolvedValueOnce(new Response("not JSON", { status: 200 }));
    await expect(sink.endEpisode!("a/b")).rejects.toThrow();
  });

  it("does not close an episode or count a capture when ingest returns an invalid success body", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => Response.json({ ok: true })));
    const sink = engineSink("http://engine.test", "test-token");
    await expect(run(sink)).rejects.toThrow();
    expect(sink.count).toBe(0);
    expect(fetch).toHaveBeenCalledOnce();
    expect(close).toHaveBeenCalledOnce();
  });
});
