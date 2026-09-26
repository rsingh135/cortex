"use client";
/** Fixture / live mode, connection state and the current day. */
import { formatDay } from "@/lib/format";
import { useConnection, useDay, type ConnectionState, type PalaceMode } from "@/lib/store";

const DOT: Record<ConnectionState, string> = {
  open: "bg-emerald-500",
  connecting: "bg-amber-400 animate-pulse",
  closed: "bg-red-500",
};

function describe(mode: PalaceMode, connection: ConnectionState): string {
  if (mode === "fixture") return connection === "open" ? "Fixture memory, ticker attached" : "Fixture memory";
  return connection === "open" ? "Live engine connected" : connection === "connecting" ? "Connecting to the live engine" : "Live engine disconnected";
}

export function ConnectionBadge() {
  const { mode, connection } = useConnection();
  const day = useDay();
  return (
    <div className="flex items-center gap-2 rounded-full bg-white/90 px-3 py-1.5 text-sm shadow-sm ring-1 ring-zinc-200 backdrop-blur" role="status" aria-live="polite" aria-label={`${describe(mode, connection)}. ${formatDay(day)}`}>
      <span className={`h-2.5 w-2.5 shrink-0 rounded-full ${DOT[connection]}`} aria-hidden />
      <span className="font-semibold uppercase tracking-wide text-zinc-800">{mode}</span>
      <span className="text-zinc-400" aria-hidden>
        ·
      </span>
      <span className="text-zinc-600" title={describe(mode, connection)}>
        {connection}
      </span>
      <span className="text-zinc-400" aria-hidden>
        ·
      </span>
      <span className="font-medium tabular-nums text-zinc-800">{formatDay(day)}</span>
    </div>
  );
}
