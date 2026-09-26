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
      className="group absolute top-0 flex -translate-x-1/2 flex-col items-center rounded px-1 focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-sky-600"
      style={{ left: `${left}%` }}
    >
      <span className={`block h-2 w-0.5 rounded-full transition-colors duration-300 ${active ? "bg-amber-500" : reached ? "bg-sky-600" : "bg-zinc-400"}`} aria-hidden />
      <span className={`mt-0.5 text-xs leading-4 tabular-nums transition-[color,transform] duration-200 group-hover:-translate-y-px group-hover:text-zinc-900 ${active ? "font-semibold text-amber-700" : reached ? "font-semibold text-zinc-800" : "text-zinc-500"}`}>{day}</span>
    </button>
  );
}
