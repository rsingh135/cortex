/**
 * Resolution ladder. docs/spec.md > Forgetting engine > The resolution ladder.
 * Every level in every condition is WebP q80 so byte accounting is fair.
 */
import sharp from "sharp";
import { LEVELS, type Level } from "@cortex/schema";

export interface LadderRung {
  level: Level;
  width: number;
  height: number;
  bytes: number;
  data: Buffer;
}

export const LEVEL_SCALE: Record<Level, number> = { L0: 1, L1: 1 / 2, L2: 1 / 4, L3: 1 / 8 };
export const WEBP_QUALITY = 80;

export async function buildLadder(image: Buffer): Promise<LadderRung[]> {
  const meta = await sharp(image).metadata();
  const w0 = meta.width;
  const h0 = meta.height;
  if (!w0 || !h0) throw new Error("ladder: image has no dimensions");
  const rungs: LadderRung[] = [];
  for (const level of LEVELS) {
    const width = Math.max(1, Math.round(w0 * LEVEL_SCALE[level]));
    const height = Math.max(1, Math.round(h0 * LEVEL_SCALE[level]));
    const data = await sharp(image).resize(width, height, { fit: "fill" }).webp({ quality: WEBP_QUALITY }).toBuffer();
    rungs.push({ level, width, height, bytes: data.byteLength, data });
  }
  return rungs;
}

/** Re-encode a stored rung for serving at a lower clarity: downscale then upscale back so detail is truly lost. */
export async function degradeForServing(rung: LadderRung, servedLevel: Level): Promise<Buffer> {
  const scale = LEVEL_SCALE[servedLevel] / LEVEL_SCALE[rung.level];
  if (scale >= 1) return rung.data;
  const w = Math.max(1, Math.round(rung.width * scale));
  const h = Math.max(1, Math.round(rung.height * scale));
  return sharp(rung.data).resize(w, h).resize(rung.width, rung.height, { kernel: "cubic" }).webp({ quality: WEBP_QUALITY }).toBuffer();
}
