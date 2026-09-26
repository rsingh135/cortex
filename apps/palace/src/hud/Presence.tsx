"use client";
/**
 * Enter / exit choreography for a card keyed by an id. A new id mounts fresh (spring in); a null id
 * keeps the last card mounted while it fades out, then unmounts it. `render` gets the id to show,
 * so the card can keep reading the store during its exit without depending on the selection.
 */
import { useCallback, useEffect, useState, type AnimationEvent, type ReactNode } from "react";

export interface PresenceProps {
  id: string | null;
  render: (id: string) => ReactNode;
  className?: string;
}

/** Unmount even if `animationend` never fires (display: none ancestors, reduced motion quirks). */
const EXIT_FALLBACK_MS = 260;

export function Presence({ id, render, className = "" }: PresenceProps) {
  const [held, setHeld] = useState<string | null>(id);
  if (id !== null && held !== id) setHeld(id);
  const exiting = id === null && held !== null;

  const finish = useCallback(() => setHeld((h) => (id === null ? null : h)), [id]);
  useEffect(() => {
    if (!exiting) return;
    const handle = setTimeout(finish, EXIT_FALLBACK_MS);
    return () => clearTimeout(handle);
  }, [exiting, finish]);

  if (held === null) return null;
  const onAnimationEnd = (e: AnimationEvent<HTMLDivElement>) => {
    if (exiting && e.target === e.currentTarget) finish();
  };
  return (
    <div key={held} className={`${exiting ? "pointer-events-none animate-card-exit" : "animate-card-enter"} ${className}`} onAnimationEnd={onAnimationEnd} aria-hidden={exiting || undefined}>
      {render(held)}
    </div>
  );
}
