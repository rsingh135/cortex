/**
 * Recall pulse timing. Pure; the components feed `Date.now()` from inside `useFrame` so the store
 * timestamps (also `Date.now()`) line up.
 */
export const PULSE_MS = 600;
export const PULSE_SCALE = 1.25;
/** The soft glow orb around a recalled object outlives the scale pulse and fades over this long. */
export const ORB_MS = 900;
/** Orb sprite size in metres at the start and end of its fade. */
export const ORB_SCALE_START = 0.9;
export const ORB_SCALE_END = 1.7;
export const ORB_PEAK_OPACITY = 0.7;
/** Hover eases the belief to this scale. */
export const HOVER_SCALE = 1.06;

/** Progress 0..1 of the pulse stamped at `pulseAt`, or null when none is running. */
export function pulseProgress(pulseAt: number, now: number): number | null {
  return progressOf(pulseAt, now, PULSE_MS);
}

/** Progress 0..1 of the glow orb for the pulse stamped at `pulseAt`, or null when it has faded. */
export function orbProgress(pulseAt: number, now: number): number | null {
  return progressOf(pulseAt, now, ORB_MS);
}

function progressOf(startedAt: number, now: number, durationMs: number): number | null {
  if (startedAt <= 0) return null;
  const t = (now - startedAt) / durationMs;
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

/** Orb opacity: a quick bloom in the first tenth, then a quadratic fade to 0. */
export function orbOpacity(progress: number): number {
  const p = clamp01(progress);
  const attack = p < 0.1 ? p / 0.1 : 1;
  const decay = (1 - p) ** 2;
  return ORB_PEAK_OPACITY * attack * decay;
}

/** Orb size: grows from start to end with a decelerating ease. */
export function orbScale(progress: number): number {
  const p = clamp01(progress);
  const eased = 1 - (1 - p) ** 3;
  return ORB_SCALE_START + (ORB_SCALE_END - ORB_SCALE_START) * eased;
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
