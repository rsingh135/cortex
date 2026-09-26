/**
 * Plays Maya's scripted month against the mock world in a real browser and records every
 * capture as the engine will receive it: a viewport screenshot plus IngestCaptureMeta.
 *
 *   pnpm play-maya                                   # record to captures/ (gitignored)
 *   pnpm play-maya --days 2 --speed 0                # only day 2, no human pacing
 *   pnpm play-maya --engine http://localhost:4000    # POST /ingest/capture instead of recording
 *   pnpm play-maya --engine ... --usage-log          # also advance the clock per day and replay Maya's usage-log recalls
 *   MOCKWORLD_URL=http://localhost:3000 (default)
 *
 * Capture triggers follow docs/spec.md: page load, click, submit, dwell. Scroll never captures.
 * Dedupe by perceptual hash is the engine's job (apps/engine/src/ingest/policy.ts), not this runner's.
 */
import { mkdirSync, writeFileSync, appendFileSync } from "node:fs";
import { join } from "node:path";
import { chromium, type Page } from "playwright";
import {
  walkupFloor,
  IngestCaptureMeta,
  IngestCaptureResponse,
  EndEpisodeResponse,
  type App,
} from "@cortex/schema";
import { mayaScript, usageLog, type ScriptStep } from "@cortex/persona";
import type { UsageLogEntry } from "@cortex/schema";

export interface CaptureRecord {
  n: number;
  meta: IngestCaptureMeta;
  file: string;
}

/** Which app a mock-world URL belongs to. */
export function appFor(url: string): App {
  const path = new URL(url, "http://x").pathname;
  if (path.startsWith("/inbox")) return "inbox";
  if (path.startsWith("/calendar")) return "calendar";
  return "mockloft";
}

/** Listing attributes from the detail page's data-* contract; null when not a listing page. */
export function listingAttrsFrom(data: Record<string, string | undefined>): IngestCaptureMeta["listing"] | undefined {
  const id = data["listingId"];
  if (!id) return undefined;
  const floor = Number(data["floor"] ?? 0);
  const elevator = data["elevator"] === "true";
  return {
    listing_id: id,
    attrs: {
      price: Number(data["price"] ?? 0),
      neighborhood: data["neighborhood"] ?? "",
      train: data["train"] ?? "",
      floor,
      elevator,
      laundry: data["laundry"] === "true",
      pets: data["pets"] === "true",
      walkup_floor: walkupFloor(floor, elevator),
    },
  };
}

/** Builds the capture metadata for one trigger. Pure, so it is unit-tested. */
export function metaFor(
  step: ScriptStep,
  page: { url: string; title: string; text: string; data: Record<string, string | undefined> },
  action: IngestCaptureMeta["action"],
): IngestCaptureMeta {
  const app: App = step.app === "landlord_chat" ? "landlord_chat" : appFor(page.url);
  const listing = listingAttrsFrom(page.data);
  const meta: IngestCaptureMeta = {
    episode_id: step.episode,
    day: step.day,
    actor: "maya",
    app,
    url: page.url,
    title: page.title,
    action,
    page_text: page.text.slice(0, 4000),
  };
  if (listing) meta.listing = listing;
  return IngestCaptureMeta.parse(meta);
}

async function snapshotPage(page: Page): Promise<{ url: string; title: string; text: string; data: Record<string, string | undefined> }> {
  const data = await page.evaluate(() => {
    const root = document.querySelector<HTMLElement>("main#app-root");
    return root ? { ...root.dataset } : {};
  });
  const text = await page.evaluate(() => document.querySelector<HTMLElement>("main#app-root")?.innerText ?? document.body.innerText);
  return { url: page.url(), title: await page.title(), text, data };
}

interface Sink {
  put(meta: IngestCaptureMeta, png: Buffer): Promise<void>;
  /** Called after the episode's final selected step, before the next day's captures. */
  endEpisode?(episodeId: string): Promise<void>;
  /** Called when the simulated day changes, before that day's steps. Engine sink advances the clock. */
  beginDay?(day: number): Promise<void>;
  /** Replays one usage-log entry (a question Maya asked) as a recall. */
  recall?(entry: UsageLogEntry): Promise<void>;
}

function fileSink(dir: string): Sink & { count: number } {
  mkdirSync(dir, { recursive: true });
  const log = join(dir, "captures.jsonl");
  writeFileSync(log, "");
  let n = 0;
  return {
    count: 0,
    async put(meta, png) {
      n += 1;
      const file = join(dir, `${String(n).padStart(4, "0")}-${meta.episode_id}-${meta.action.type}.png`);
      writeFileSync(file, png);
      appendFileSync(log, `${JSON.stringify({ n, file, meta: { ...meta, page_text: undefined }, page_text_len: meta.page_text?.length ?? 0 })}\n`);
      this.count = n;
    },
  };
}

export function engineSink(engineUrl: string, token: string): Sink & { count: number } {
  const baseUrl = engineUrl.replace(/\/$/, "");
  return {
    count: 0,
    async put(meta, png) {
      const form = new FormData();
      form.set("meta", JSON.stringify(meta));
      form.set("image", new Blob([new Uint8Array(png)], { type: "image/png" }), "capture.png");
      const res = await fetch(`${baseUrl}/ingest/capture`, { method: "POST", body: form, headers: { "x-cortex-write-token": token } });
      if (!res.ok) throw new Error(`ingest failed ${res.status}: ${await res.text()}`);
      IngestCaptureResponse.parse(await res.json());
      this.count += 1;
    },
    async beginDay(day) {
      const res = await fetch(`${baseUrl}/clock/advance`, { method: "POST", headers: { "content-type": "application/json", "x-cortex-write-token": token }, body: JSON.stringify({ to_day: day }) });
      if (!res.ok && res.status !== 501) throw new Error(`clock/advance to ${day} failed ${res.status}: ${await res.text()}`);
    },
    async recall(entry) {
      const res = await fetch(`${baseUrl}/recall`, {
        method: "POST",
        headers: { "content-type": "application/json", "x-cortex-write-token": token },
        body: JSON.stringify({ query: entry.text, condition: "cortex", rooms: entry.rooms, by: "usage_log", reason: `usage log day ${entry.day}`, dry_run: false, limit: 10 }),
      });
      if (!res.ok && res.status !== 501) throw new Error(`recall on day ${entry.day} failed ${res.status}: ${await res.text()}`);
    },
    async endEpisode(episodeId) {
      const res = await fetch(`${baseUrl}/episodes/${encodeURIComponent(episodeId)}/end`, {
        method: "POST",
        headers: { "x-cortex-write-token": token },
      });
      if (!res.ok) throw new Error(`end episode ${episodeId} failed ${res.status}: ${await res.text()}`);
      const result = EndEpisodeResponse.parse(await res.json());
      if (result.episode_id !== episodeId)
        throw new Error(`end episode ${episodeId} returned a different episode ID`);
    },
  };
}

export interface RunOptions {
  mockworldUrl: string;
  days?: number[];
  speed: number;
  sink: Sink & { count: number };
  token: string;
  steps?: ScriptStep[];
  /** Replay Maya's usage log: recalls on the days she asked, so used memories stay sharp. */
  usage?: UsageLogEntry[];
}

export async function playMaya(opts: RunOptions): Promise<number> {
  const steps = (opts.steps ?? mayaScript()).filter((s) => !opts.days || opts.days.includes(s.day));
  const lastStepByEpisode = new Map(steps.map((step, index) => [step.episode, index]));
  const browser = await chromium.launch();
  const host = new URL(opts.mockworldUrl);
  const context = await browser.newContext({
    viewport: { width: 1280, height: 800 },
    extraHTTPHeaders: { "x-cortex-write-token": opts.token },
  });
  const page = await context.newPage();
  let currentDay = -1;
  const usage = [...(opts.usage ?? [])].sort((a, b) => a.day - b.day);
  const setDay = async (day: number): Promise<void> => {
    if (day === currentDay) return;
    // Usage-log mode: days with no captures still advance the clock and replay their recalls.
    if (opts.usage) {
      for (let d = currentDay < 0 ? day : currentDay + 1; d <= day; d++) {
        await opts.sink.beginDay?.(d);
        for (const entry of usage.filter((u) => u.day === d && u.kind === "question")) await opts.sink.recall?.(entry);
      }
    }
    currentDay = day;
    await context.addCookies([{ name: "cortex-day", value: String(day), domain: host.hostname, path: "/" }]);
  };
  const pause = (s: number): Promise<void> => new Promise((r) => setTimeout(r, s * 1000 * opts.speed));
  const capture = async (step: ScriptStep, action: IngestCaptureMeta["action"]): Promise<void> => {
    const snap = await snapshotPage(page);
    const png = await page.screenshot({ type: "png" });
    await opts.sink.put(metaFor(step, snap, action), png);
  };

  try {
    for (const [index, step] of steps.entries()) {
      await setDay(step.day);
      await pause(step.pause_s);
      switch (step.action) {
        case "open": {
          await page.goto(`${opts.mockworldUrl}${step.target ?? "/"}`, { waitUntil: "networkidle" });
          await capture(step, { type: "load" });
          break;
        }
        case "dwell": {
          await capture(step, { type: "dwell" });
          break;
        }
        case "read": {
          const link = page.locator(`a[data-thread-id="${step.target}"]`).first();
          if ((await link.count()) === 0) {
            await page.goto(`${opts.mockworldUrl}/inbox/${step.target}`, { waitUntil: "networkidle" });
            await capture(step, { type: "load" });
            break;
          }
          const text = (await link.innerText()).slice(0, 80);
          const box = await link.boundingBox();
          await link.click();
          await page.waitForLoadState("networkidle");
          await capture(step, { type: "click", text, ...(box ? { bbox: [box.x, box.y, box.width, box.height] as [number, number, number, number] } : {}) });
          break;
        }
        case "reject": {
          const btn = page.locator("#reject");
          if ((await btn.count()) === 0) {
            console.warn(`skip reject on ${step.target}: no Reject button (already rejected? restart the mock world for a clean run)`);
            break;
          }
          const box = await btn.boundingBox();
          await btn.click();
          await page.waitForTimeout(300);
          await capture(step, { type: "click", text: "Reject", ...(box ? { bbox: [box.x, box.y, box.width, box.height] as [number, number, number, number] } : {}) });
          break;
        }
        case "message": {
          const form = page.locator("#message-form");
          await form.locator("textarea").fill(step.text ?? "");
          const send = form.getByRole("button", { name: "Send message" });
          const box = await send.boundingBox();
          await send.click();
          await page.waitForTimeout(400);
          await capture(step, { type: "submit", text: "Send message", ...(box ? { bbox: [box.x, box.y, box.width, box.height] as [number, number, number, number] } : {}) });
          break;
        }
        case "click": {
          const el = page.locator(step.target ?? "body").first();
          const box = await el.boundingBox();
          await el.click();
          await page.waitForLoadState("networkidle");
          await capture(step, { type: "click", text: step.text ?? "", ...(box ? { bbox: [box.x, box.y, box.width, box.height] as [number, number, number, number] } : {}) });
          break;
        }
      }
      if (lastStepByEpisode.get(step.episode) === index)
        await opts.sink.endEpisode?.(step.episode);
    }
  } finally {
    await browser.close();
  }
  return opts.sink.count;
}

async function main(): Promise<void> {
  const argv = process.argv.slice(2);
  const arg = (flag: string): string | undefined => {
    const i = argv.indexOf(flag);
    return i >= 0 ? argv[i + 1] : undefined;
  };
  const mockworldUrl = process.env["MOCKWORLD_URL"] ?? "http://localhost:3000";
  const token = process.env["CORTEX_WRITE_TOKEN"] ?? "change-me";
  const daysArg = arg("--days");
  const days = daysArg ? daysArg.split(",").map(Number) : undefined;
  const speed = Number(arg("--speed") ?? "0");
  const engine = arg("--engine");
  const out = arg("--out") ?? "captures";
  const withUsage = argv.includes("--usage-log");
  const sink = engine ? engineSink(engine, token) : fileSink(out);
  const started = Date.now();
  const n = await playMaya({ mockworldUrl, speed, sink, token, ...(days ? { days } : {}), ...(withUsage ? { usage: usageLog() } : {}) });
  console.log(`${n} captures in ${((Date.now() - started) / 1000).toFixed(1)}s -> ${engine ?? out}`);
}

if (process.argv[1] && /play-maya\.ts$/.test(process.argv[1])) {
  main().catch((err) => {
    console.error(err instanceof Error ? err.message : err);
    process.exit(1);
  });
}
