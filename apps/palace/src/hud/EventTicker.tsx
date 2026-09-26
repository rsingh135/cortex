"use client";
/** The last few memory events, newest first, as one-liners. */
import { useMemo } from "react";
import { describeEvent, lookupFor } from "@/lib/events";
import { useRecentEvents, useSnapshot } from "@/lib/store";

export interface EventTickerProps {
  count?: number;
}

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
    <ol className="w-80 space-y-1 text-[13px] leading-5" aria-label="Recent memory events" aria-live="polite" aria-relevant="additions">
      {lines.map((line, i) => (
        <li key={line.id} className={`truncate rounded-md bg-white/85 px-2 py-1 ring-1 ring-zinc-200 backdrop-blur ${i === 0 ? "text-zinc-900" : "text-zinc-500"}`} title={line.text}>
          <span className="mr-1.5 tabular-nums text-zinc-400">d{line.day}</span>
          {line.text}
        </li>
      ))}
    </ol>
  );
}
