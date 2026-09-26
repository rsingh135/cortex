"use client";
/** "Replay 12/76" beside the connection badge while a recorded log plays, with a stop button. */
import type { CSSProperties } from "react";
import { usePalaceActions, useReplay } from "@/lib/store";

export function ReplayChip() {
  const replay = useReplay();
  const { stopReplay } = usePalaceActions();
  if (replay.status === "idle") return null;
  const label = replay.status === "loading" ? "Loading replay" : replay.status === "done" ? `Replayed ${replay.total}` : `Replay ${replay.played}/${replay.total}`;
  const fraction = replay.total ? replay.played / replay.total : 0;
  return (
    <div className="glass animate-card-enter flex items-center gap-2.5 rounded-full py-1.5 pl-3 pr-1.5 text-[13px] leading-5" role="status" aria-live="polite">
      <span className="relative inline-flex h-2 w-2 shrink-0">
        <span className={`absolute inset-0 rounded-full ${replay.status === "playing" ? "bg-sky-500 animate-breathe" : "bg-zinc-400"}`} style={{ "--dot": "#0ea5e9" } as CSSProperties} aria-hidden />
      </span>
      <span className="font-semibold tabular-nums text-zinc-900">{label}</span>
      <span className="h-1.5 w-20 overflow-hidden rounded-full bg-zinc-900/10" aria-hidden>
        <span className="block h-full rounded-full bg-sky-500 transition-[width] duration-300 ease-out" style={{ width: `${Math.round(fraction * 100)}%` }} />
      </span>
      {replay.status === "playing" || replay.status === "loading" ? (
        <button type="button" onClick={stopReplay} aria-label="Stop replay" className="lift flex h-6 items-center rounded-full bg-zinc-900 px-2.5 text-[11px] font-semibold uppercase tracking-[0.06em] text-white hover:bg-zinc-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-600">
          stop
        </button>
      ) : null}
    </div>
  );
}
