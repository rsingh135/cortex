/**
 * Byte accounting, mirroring tools/simulate.ts `levelBytes`: lower rungs scale by pixel area.
 */
import { LEVELS, type Level } from "@cortex/schema";
import type { PalaceBytes, PalaceCapture } from "./types";

export const DEFAULT_L0_BYTES = 150_000;

const LEVEL_SCALE: Record<Level, number> = { L0: 1, L1: 1 / 4, L2: 1 / 16, L3: 1 / 64 };

export function levelBytes(level: Level, l0Bytes: number = DEFAULT_L0_BYTES): number {
  return Math.round(l0Bytes * LEVEL_SCALE[level]);
}

/** Bytes the cortex condition currently holds for one capture. */
export function captureBytes(capture: Pick<PalaceCapture, "aliveLevels" | "l0Bytes">): number {
  return capture.aliveLevels.reduce((sum, lvl) => sum + levelBytes(lvl, capture.l0Bytes), 0);
}

/** Bytes keep-everything would hold for the same capture: every rung, forever. */
export function keepAllBytes(l0Bytes: number): number {
  return LEVELS.reduce((sum, lvl) => sum + levelBytes(lvl, l0Bytes), 0);
}

/** Totals for captures that exist on `day` (created on or before it). */
export function snapshotBytes(captures: readonly PalaceCapture[], day: number): PalaceBytes {
  let cortex = 0;
  let keepAll = 0;
  for (const c of captures) {
    if (c.day > day) continue;
    cortex += captureBytes(c);
    keepAll += keepAllBytes(c.l0Bytes);
  }
  return { cortex, keepAll };
}
