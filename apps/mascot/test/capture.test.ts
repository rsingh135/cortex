/**
 * The screen-capture loop, with Electron's capturer injected so nothing touches a real display.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";
import { createScreenCapture } from "../src/main/capture";

const png = Buffer.from([0x89, 0x50, 0x4e, 0x47]);
const grab = async () => ({ png, title: "Safari — MockLoft" });

function engine(overrides: Record<string, unknown> = {}) {
  const calls: { url: string; method: string; body?: unknown }[] = [];
  const fetchFn = vi.fn(async (url: string | URL, init?: RequestInit) => {
    const href = String(url);
    calls.push({ href, url: href, method: init?.method ?? "GET", body: init?.body } as never);
    if (href.includes("/map")) return Response.json({ day: 7, rooms: [], recent_changes: [] });
    if (href.includes("/episodes/") && href.endsWith("/end"))
      return Response.json({ episode_id: "ep_1", summary: "done" });
    if (href.includes("/episodes")) return Response.json({ episode_id: "ep_1" });
    if (href.includes("/ingest/capture"))
      return Response.json({ capture_id: "cap_1", stored: true, phash: "0" });
    return new Response("no", { status: 404 });
  });
  return { calls, fetchFn: fetchFn as unknown as typeof fetch, ...overrides };
}

beforeEach(() => vi.useRealTimers());

describe("screen capture", () => {
  it("adopts the engine's day, opens an episode, and posts a capture immediately", async () => {
    const { calls, fetchFn } = engine();
    const capture = createScreenCapture({ engineUrl: "http://localhost:4000/", fetchFn, grab });
    expect(capture.running).toBe(false);
    await capture.start();
    expect(capture.running).toBe(true);

    const urls = calls.map((c) => c.url);
    expect(urls[0]).toBe("http://localhost:4000/map?condition=cortex");
    expect(urls[1]).toBe("http://localhost:4000/episodes");
    // The episode carries the engine's own day, or ingest would reject the capture.
    expect(JSON.parse(String(calls[1]!.body))).toMatchObject({ day: 7, actor: "maya", app: "desktop" });
    expect(urls[2]).toBe("http://localhost:4000/ingest/capture");
    expect(capture.stats).toEqual({ taken: 1, stored: 1 });
    await capture.stop();
  });

  it("sends multipart meta the engine will accept", async () => {
    const { calls, fetchFn } = engine();
    const capture = createScreenCapture({ engineUrl: "http://localhost:4000", fetchFn, grab });
    await capture.start();
    const form = calls.find((c) => c.url.endsWith("/ingest/capture"))!.body as FormData;
    const meta = JSON.parse(String(form.get("meta")));
    expect(meta).toMatchObject({
      episode_id: "ep_1", day: 7, actor: "maya", app: "desktop",
      url: "desktop://primary", title: "Safari — MockLoft", action: { type: "dwell" },
    });
    expect(form.get("image")).toBeInstanceOf(Blob);
    await capture.stop();
  });

  it("ends the episode on stop and goes quiet", async () => {
    const { calls, fetchFn } = engine();
    const capture = createScreenCapture({ engineUrl: "http://localhost:4000", fetchFn, grab });
    await capture.start();
    await capture.stop();
    expect(capture.running).toBe(false);
    expect(calls.some((c) => c.url.endsWith("/episodes/ep_1/end"))).toBe(true);
    const after = calls.length;
    await capture.stop();
    expect(calls.length).toBe(after);
  });

  it("reports an ingest failure without stopping the session", async () => {
    const onError = vi.fn();
    const fetchFn = vi.fn(async (url: string | URL) => {
      const href = String(url);
      if (href.includes("/map")) return Response.json({ day: 0, rooms: [], recent_changes: [] });
      if (href.includes("/episodes")) return Response.json({ episode_id: "ep_1" });
      return new Response("too big", { status: 413 });
    }) as unknown as typeof fetch;
    const capture = createScreenCapture({ engineUrl: "http://localhost:4000", fetchFn, grab, onError });
    await capture.start();
    expect(onError).toHaveBeenCalledOnce();
    expect(capture.running).toBe(true);
    expect(capture.stats.taken).toBe(0);
    await capture.stop();
  });

  it("skips a capture when the screen grab yields nothing", async () => {
    const { calls, fetchFn } = engine();
    const capture = createScreenCapture({
      engineUrl: "http://localhost:4000", fetchFn, grab: async () => null,
    });
    await capture.start();
    expect(calls.some((c) => c.url.endsWith("/ingest/capture"))).toBe(false);
    expect(capture.stats.taken).toBe(0);
    await capture.stop();
  });

  it("never starts on its own, and starting twice opens one episode", async () => {
    const { calls, fetchFn } = engine();
    const capture = createScreenCapture({ engineUrl: "http://localhost:4000", fetchFn, grab });
    expect(calls.length).toBe(0);
    await capture.start();
    const afterFirst = calls.filter((c) => c.url.endsWith("/episodes")).length;
    await capture.start();
    expect(calls.filter((c) => c.url.endsWith("/episodes")).length).toBe(afterFirst);
    await capture.stop();
  });
});
