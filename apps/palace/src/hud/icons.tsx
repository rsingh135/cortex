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

export function CopyIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" aria-hidden fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round">
      <rect x="4.5" y="4.5" width="7.5" height="7.5" rx="1.5" />
      <path d="M9.5 4.5V3.2A1.2 1.2 0 0 0 8.3 2H3.2A1.2 1.2 0 0 0 2 3.2v5.1a1.2 1.2 0 0 0 1.2 1.2h1.3" />
    </svg>
  );
}

export function CheckIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" aria-hidden fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M2.5 7.5l3 3 6-6.5" />
    </svg>
  );
}
