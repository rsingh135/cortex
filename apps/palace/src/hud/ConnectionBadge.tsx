"use client";
/** Fixture / live mode, connection state and the current day. The dot breathes while a connection is up. */
import type { CSSProperties } from "react";
import { formatDay } from "@/lib/format";
import { useConnection, useDay, type ConnectionState, type PalaceMode } from "@/lib/store";

interface DotStyle {
  color: string;
  className: string;
}

const DOT: Record<ConnectionState, DotStyle> = {
  open: { color: "#10b981", className: "bg-emerald-500 animate-breathe" },
  connecting: { color: "#f59e0b", className: "bg-amber-400 animate-breathe [animation-duration:1.1s]" },
  closed: { color: "#ef4444", className: "bg-red-500" },
};

const MODE: Record<PalaceMode, string> = {
  live: "bg-sky-600 text-white",
  fixture: "bg-zinc-900 text-white",
};

function describe(mode: PalaceMode, connection: ConnectionState): string {
  if (mode === "fixture") return connection === "open" ? "Fixture memory, ticker attached" : "Fixture memory";
  return connection === "open" ? "Live engine connected" : connection === "connecting" ? "Connecting to the live engine" : "Live engine disconnected";
}

export function ConnectionBadge() {
  const { mode, connection } = useConnection();
  const day = useDay();
  const dot = DOT[connection];
  return (
    <div className="glass flex items-center gap-2 rounded-full py-1.5 pl-2.5 pr-3.5 text-[13px] leading-5" role="status" aria-live="polite" aria-label={`${describe(mode, connection)}. ${formatDay(day)}`}>
      <span className={`inline-flex items-center gap-1.5 rounded-full py-0.5 pl-2 pr-2.5 text-[11px] font-semibold uppercase tracking-[0.08em] ${MODE[mode]}`}>
        <span className={`h-2 w-2 shrink-0 rounded-full ${dot.className}`} style={{ "--dot": dot.color } as CSSProperties} aria-hidden />
        {mode}
      </span>
      <span className="text-zinc-600" title={describe(mode, connection)}>
        {connection}
      </span>
      <span className="h-3.5 w-px bg-zinc-900/15" aria-hidden />
      <span className="font-semibold tabular-nums text-zinc-900">{formatDay(day)}</span>
    </div>
  );
}
