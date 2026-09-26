/**
 * Records the palace running beats 1 and 2 on its own (replay, then fast-forward to day 30, then
 * the chart) and writes apps/palace/public/demo/fallback.mp4, the `F` hotkey's safety net.
 * Run it on the demo laptop with a real GPU for a smooth capture; the software renderer works but
 * drops frames.
 *
 *   pnpm --filter @cortex/palace build && pnpm --filter @cortex/palace start -p 3001 &
 *   pnpm record-fallback [--url http://localhost:3001] [--out apps/palace/public/demo/fallback.mp4] [--headed]
 *
 * Needs ffmpeg on PATH for the webm -> mp4 conversion; without it the webm is kept next to the mp4 path.
 */
import { execFileSync } from "node:child_process";
import { copyFileSync, existsSync, mkdirSync, mkdtempSync, readdirSync, unlinkSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { chromium } from "playwright";

export interface RecordOptions {
  url: string;
  out: string;
  headed: boolean;
  /** Seconds to let the replay run before fast-forwarding. */
  replaySeconds: number;
}

function hasFfmpeg(): boolean {
  try {
    execFileSync("ffmpeg", ["-version"], { stdio: "ignore" });
    return true;
  } catch {
    return false;
  }
}

export async function recordFallback(opts: RecordOptions): Promise<string> {
  const videoDir = mkdtempSync(join(tmpdir(), "cortex-fallback-"));
  const browser = await chromium.launch({
    headless: !opts.headed,
    args: opts.headed ? [] : ["--use-gl=swiftshader", "--enable-webgl", "--ignore-gpu-blocklist"],
  });
  const context = await browser.newContext({ viewport: { width: 1920, height: 1080 }, recordVideo: { dir: videoDir, size: { width: 1920, height: 1080 } } });
  const page = await context.newPage();

  // Beat 1: memory forms.
  await page.goto(`${opts.url}/palace?mode=fixture`, { waitUntil: "load" });
  await page.waitForTimeout(5000);
  await page.keyboard.press("r");
  await page.waitForTimeout(4000);
  await page.click("text=Housing").catch(() => {});
  await page.waitForTimeout(opts.replaySeconds * 1000);

  // Beat 2: memory fades. The replayed captures carry no recall history, so reload the seeded memory
  // (which has the usage log baked in), scrub back to day 5, then fast-forward: one day per 400 ms.
  await page.goto(`${opts.url}/palace?mode=fixture`, { waitUntil: "load" });
  await page.waitForTimeout(4000);
  await page.click("text=Housing").catch(() => {});
  await page.waitForTimeout(2500);
  await page.evaluate(() => {
    const input = document.querySelector<HTMLInputElement>("input.scrubber");
    if (!input) return;
    const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set;
    setter?.call(input, "5");
    input.dispatchEvent(new Event("input", { bubbles: true }));
    input.dispatchEvent(new Event("change", { bubbles: true }));
  });
  await page.waitForTimeout(2500);
  await page.getByRole("button", { name: /30/ }).first().click().catch(() => {});
  await page.waitForTimeout(14_000);

  // Beat 5: the proof.
  await page.keyboard.press("c");
  await page.waitForTimeout(6000);

  await context.close();
  await browser.close();

  const webm = readdirSync(videoDir)
    .filter((f) => f.endsWith(".webm"))
    .map((f) => join(videoDir, f))[0];
  if (!webm) throw new Error("Playwright wrote no video");
  mkdirSync(dirname(opts.out), { recursive: true });
  if (!hasFfmpeg()) {
    const fallbackWebm = opts.out.replace(/\.mp4$/, ".webm");
    copyFileSync(webm, fallbackWebm);
    return fallbackWebm;
  }
  if (existsSync(opts.out)) unlinkSync(opts.out);
  execFileSync("ffmpeg", ["-loglevel", "error", "-i", webm, "-c:v", "libx264", "-preset", "medium", "-crf", "22", "-pix_fmt", "yuv420p", "-movflags", "+faststart", "-an", opts.out], { stdio: "inherit" });
  return opts.out;
}

async function main(): Promise<void> {
  const argv = process.argv.slice(2);
  const arg = (flag: string): string | undefined => {
    const i = argv.indexOf(flag);
    return i >= 0 ? argv[i + 1] : undefined;
  };
  const out = await recordFallback({
    url: (arg("--url") ?? "http://localhost:3001").replace(/\/$/, ""),
    out: arg("--out") ?? "apps/palace/public/demo/fallback.mp4",
    headed: argv.includes("--headed"),
    replaySeconds: Number(arg("--replay-seconds") ?? "40"),
  });
  console.log(`wrote ${out}`);
}

if (process.argv[1] && /record-fallback\.ts$/.test(process.argv[1])) {
  main().catch((err) => {
    console.error(err instanceof Error ? err.message : err);
    process.exit(1);
  });
}
