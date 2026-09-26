/**
 * Recall pulse timing. Pure; the components feed `Date.now()` from inside `useFrame` so the store
 * timestamps (also `Date.now()`) line up.
 */
export const PULSE_MS = 600;
export const PULSE_SCALE = 1.25;

/** Progress 0..1 of the pulse stamped at `pulseAt`, or null when none is running. */
export function pulseProgress(pulseAt: number, now: number): number | null {
  if (pulseAt <= 0) return null;
  const t = (now - pulseAt) / PULSE_MS;
  return t < 0 || t >= 1 ? null : t;
}

/** Scale 1 -> 1.25 -> 1 over the pulse. */
export function pulseScale(progress: number): number {
  return 1 + (PULSE_SCALE - 1) * Math.sin(Math.PI * progress);
}

/** Warm rim glow 0 -> 1 -> 0 over the pulse. */
export function pulseGlow(progress: number): number {
  return Math.sin(Math.PI * progress);
}

/**
 * How sharp a painting is forced after a recall: 1 during the hold, easing to 0 over the fade.
 * Returns 0 when no recall is in effect.
 */
export function sharpenAmount(pulseAt: number, now: number, holdMs: number, fadeMs: number): number {
  if (pulseAt <= 0) return 0;
  const since = now - pulseAt;
  if (since < 0) return 0;
  if (since < holdMs) return 1;
  const t = (since - holdMs) / fadeMs;
  return t >= 1 ? 0 : 1 - t;
}

export function clamp01(v: number): number {
  return v < 0 ? 0 : v > 1 ? 1 : v;
}
