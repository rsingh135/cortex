"use client";
/** Tiny inline icons for HUD buttons. All decorative (aria-hidden); the buttons carry labels. */

export function PlayIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" aria-hidden>
      <path d="M3 2l9 5-9 5z" fill="currentColor" />
    </svg>
  );
}

export function PauseIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" aria-hidden>
      <rect x="2.5" y="2" width="3.5" height="10" fill="currentColor" />
      <rect x="8" y="2" width="3.5" height="10" fill="currentColor" />
    </svg>
  );
}

export function FastForwardIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" aria-hidden>
      <path d="M1 2.5l6 4.5-6 4.5zM7 2.5l6 4.5-6 4.5z" fill="currentColor" />
    </svg>
  );
}
