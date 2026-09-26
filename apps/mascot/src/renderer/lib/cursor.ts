/** Bounded, subtle tilt even when the desktop pointer is on another display. */
export function cursorTilt(dx: number, dy: number) {
  const clamp = (value: number) => Number.isFinite(value) ? Math.max(-1, Math.min(1, value / 240)) : 0;
  return { x: clamp(dx) * 9, y: clamp(dy) * 6 };
}
