"use client";
/** The last few memory events, newest first, as one-liners. New lines slide in; older ones fade back. */
import { useMemo } from "react";
import { describeEvent, lookupFor } from "@/lib/events";
import { useRecentEvents, useSnapshot } from "@/lib/store";

export interface EventTickerProps {
  count?: number;
}

const STAGGER_MS = 45;

export function EventTicker({ count = 4 }: EventTickerProps) {
  const events = useRecentEvents();
  const snapshot = useSnapshot();
  const lines = useMemo(() => {
    const lookup = lookupFor(snapshot);
    return events
      .filter((e) => e.type !== "snapshot")
      .slice(0, count)
      .map((e) => ({ id: e.id, day: e.day, text: describeEvent(e, lookup) }));
  }, [events, snapshot, count]);
  if (lines.length === 0) return null;
  return (
    <ol className="w-80 space-y-1.5 text-[13px] leading-5" aria-label="Recent memory events" aria-live="polite" aria-relevant="additions">
      {lines.map((line, i) => (
        <li key={line.id} className={`glass flex items-center gap-2 truncate rounded-lg px-2.5 py-1.5 animate-ticker-in ${i === 0 ? "text-zinc-900" : "text-zinc-600"}`} style={{ animationDelay: `${i * STAGGER_MS}ms`, opacity: i === 0 ? undefined : 1 - i * 0.08 }} title={line.text}>
          <span className={`shrink-0 rounded-md px-1.5 font-mono text-[11px] leading-4 tabular-nums ${i === 0 ? "bg-sky-600/10 text-sky-800" : "bg-zinc-900/6 text-zinc-600"}`}>d{line.day}</span>
          <span className="truncate">{line.text}</span>
        </li>
      ))}
    </ol>
  );
}
