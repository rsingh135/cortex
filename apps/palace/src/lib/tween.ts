/**
 * Number tweening for the HUD's animated counters (storage MB, "% saved"). Pure: the hook in
 * `src/hud` feeds it clock time and reads back the value to show. No imports.
 */

export type Easing = (t: number) => number;

/** Decelerating cubic: fast start, gentle landing. */
export const easeOutCubic: Easing = (t) => 1 - (1 - t) ** 3;

export interface TweenSample {
  value: number;
  done: boolean;
}

/** Value of a tween from `from` to `to` after `elapsedMs` of `durationMs`. */
export function tweenAt(from: number, to: number, elapsedMs: number, durationMs: number, ease: Easing = easeOutCubic): TweenSample {
  if (!Number.isFinite(from)) from = to;
  if (durationMs <= 0 || elapsedMs >= durationMs) return { value: to, done: true };
  if (elapsedMs <= 0) return { value: from, done: false };
  const t = ease(elapsedMs / durationMs);
  return { value: from + (to - from) * t, done: false };
}

/** Round to `digits` decimals so a mid-tween value formats without float dust. */
export function quantize(value: number, digits: number): number {
  const f = 10 ** Math.max(0, Math.round(digits));
  return Math.round(value * f) / f;
}
