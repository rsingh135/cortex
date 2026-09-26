/**
 * Automatic screen capture. The pet watches the real desktop the way the Playwright replay watches
 * the mock world: a screenshot on a timer, posted to the engine's POST /ingest/capture, where the
 * ladder, the forgetting sweep and the extraction queue treat it like any other memory.
 *
 * Off unless the user turns it on. This photographs the whole screen, so it is opt-in, it reports
 * its state in the tray, and nothing is captured before the first explicit start.
 *
 * Deduplication is the engine's job: captures inside one episode are compared by perceptual hash, so
 * a screen that has not changed costs nothing. One session is one episode.
 */
import { desktopCapturer, screen } from "electron";

export const DEFAULT_INTERVAL_MS = 20_000;
/** The engine rejects anything past 16 million pixels; this stays far below it. */
export const MAX_CAPTURE_WIDTH = 1920;

export interface CaptureDeps {
  engineUrl: string;
  intervalMs?: number;
  fetchFn?: typeof fetch;
  /** Injected in tests; defaults to Electron's capturer. */
  grab?: () => Promise<{ png: Buffer; title: string } | null>;
  onError?: (error: unknown) => void;
  onCapture?: (info: { capture_id: string; stored: boolean }) => void;
}

export interface ScreenCapture {
  start(): Promise<void>;
  stop(): Promise<void>;
  readonly running: boolean;
  /** Captures taken this session, and how many the engine actually stored. */
  readonly stats: { taken: number; stored: number };
}

async function grabPrimaryScreen(): Promise<{ png: Buffer; title: string } | null> {
  const display = screen.getPrimaryDisplay();
  const scale = Math.min(1, MAX_CAPTURE_WIDTH / Math.max(1, display.size.width));
  const sources = await desktopCapturer.getSources({
    types: ["screen"],
    thumbnailSize: {
      width: Math.max(1, Math.round(display.size.width * scale)),
      height: Math.max(1, Math.round(display.size.height * scale)),
    },
  });
  const source = sources[0];
  if (!source || source.thumbnail.isEmpty()) return null;
  return { png: source.thumbnail.toPNG(), title: source.name || "Desktop" };
}

export function createScreenCapture(deps: CaptureDeps): ScreenCapture {
  const fetchFn = deps.fetchFn ?? fetch;
  const grab = deps.grab ?? grabPrimaryScreen;
  const interval = Math.max(2_000, deps.intervalMs ?? DEFAULT_INTERVAL_MS);
  const base = deps.engineUrl.replace(/\/+$/, "");
  let timer: ReturnType<typeof setInterval> | null = null;
  let episodeId: string | null = null;
  let day = 0;
  let inFlight = false;
  const stats = { taken: 0, stored: 0 };

  /** The engine refuses a capture dated before its clock, so the session adopts the engine's day. */
  const currentDay = async (): Promise<number> => {
    const res = await fetchFn(`${base}/map?condition=cortex`);
    if (!res.ok) throw new Error(`engine /map ${res.status}`);
    const body = (await res.json()) as { day?: unknown };
    return typeof body.day === "number" ? body.day : 0;
  };

  const startEpisode = async (): Promise<string> => {
    const res = await fetchFn(`${base}/episodes`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ day, actor: "maya", app: "desktop" }),
    });
    if (!res.ok) throw new Error(`engine /episodes ${res.status}`);
    const body = (await res.json()) as { episode_id?: unknown };
    if (typeof body.episode_id !== "string")
      throw new Error("engine /episodes returned no episode_id");
    return body.episode_id;
  };

  const once = async (): Promise<void> => {
    // A slow ingest must not queue up behind the timer.
    if (inFlight || !episodeId) return;
    inFlight = true;
    try {
      const shot = await grab();
      if (!shot) return;
      const form = new FormData();
      form.append(
        "meta",
        JSON.stringify({
          episode_id: episodeId,
          day,
          actor: "maya",
          app: "desktop",
          url: "desktop://primary",
          title: shot.title,
          action: { type: "dwell" },
        }),
      );
      form.append(
        "image",
        new Blob([new Uint8Array(shot.png)], { type: "image/png" }),
        "screen.png",
      );
      const res = await fetchFn(`${base}/ingest/capture`, {
        method: "POST",
        body: form,
      });
      if (!res.ok) throw new Error(`engine /ingest/capture ${res.status}`);
      const body = (await res.json()) as { capture_id?: string; stored?: boolean };
      stats.taken += 1;
      if (body.stored) stats.stored += 1;
      if (body.capture_id)
        deps.onCapture?.({
          capture_id: body.capture_id,
          stored: Boolean(body.stored),
        });
    } catch (error) {
      deps.onError?.(error);
    } finally {
      inFlight = false;
    }
  };

  return {
    get running() {
      return timer !== null;
    },
    get stats() {
      return { ...stats };
    },
    async start() {
      if (timer) return;
      day = await currentDay();
      episodeId = await startEpisode();
      timer = setInterval(() => void once(), interval);
      // Capture immediately so turning it on visibly does something.
      await once();
    },
    async stop() {
      if (timer) {
        clearInterval(timer);
        timer = null;
      }
      const ending = episodeId;
      episodeId = null;
      if (!ending) return;
      try {
        await fetchFn(`${base}/episodes/${encodeURIComponent(ending)}/end`, {
          method: "POST",
        });
      } catch (error) {
        deps.onError?.(error);
      }
    },
  };
}
