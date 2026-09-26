"use client";
/** One checkpoint on the scrubber: jumps back, fast-forwards ahead. */
import { formatDay } from "@/lib/format";

export interface TimelineTickProps {
  day: number;
  current: number;
  /** Percent along the track. */
  left: number;
  active: boolean;
  onJump(day: number): void;
  onFastForward(day: number): void;
}

export function TimelineTick({ day, current, left, active, onJump, onFastForward }: TimelineTickProps) {
  const ahead = day > current;
  const reached = day <= current;
  const label = ahead ? `Fast-forward to ${formatDay(day)}` : `Jump to ${formatDay(day)}`;
  return (
    <button
      type="button"
      onClick={() => (ahead ? onFastForward(day) : onJump(day))}
      aria-label={label}
      aria-pressed={active}
      title={label}
      className="group absolute top-0 flex -translate-x-1/2 flex-col items-center rounded focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-sky-600"
      style={{ left: `${left}%` }}
    >
      <span className={`block h-2 w-px ${reached ? "bg-sky-600" : "bg-zinc-300"} ${active ? "bg-amber-500" : ""}`} aria-hidden />
      <span className={`mt-0.5 text-xs leading-4 tabular-nums group-hover:text-zinc-900 ${reached ? "font-semibold text-zinc-700" : "text-zinc-400"} ${active ? "text-amber-700" : ""}`}>{day}</span>
    </button>
  );
}
