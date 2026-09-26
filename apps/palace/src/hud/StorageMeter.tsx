"use client";
/** Cortex bytes vs keep-everything bytes: two bars on the same scale plus the saving, counters tweened on change. */
import { formatPercent, formatRatio } from "@/lib/format";
import { useBytes } from "@/lib/store";
import { StorageBar } from "./StorageBar";
import { useTweenedNumber } from "./useTweenedNumber";

export function StorageMeter() {
  const { cortex, keepAll } = useBytes();
  const fraction = keepAll > 0 ? Math.min(1, cortex / keepAll) : 0;
  const saved = keepAll > 0 ? Math.max(0, 1 - cortex / keepAll) : 0;
  const shownCortex = useTweenedNumber(cortex, { durationMs: 900, digits: 0, from: 0 });
  const shownKeepAll = useTweenedNumber(keepAll, { durationMs: 900, digits: 0, from: 0 });
  const shownSaved = useTweenedNumber(saved, { durationMs: 900, digits: 4, from: 0 });
  return (
    <div className="glass w-72 rounded-2xl p-3.5 text-[13px] leading-5" role="group" aria-label="Storage">
      <div className="mb-2.5 flex items-baseline justify-between">
        <span className="font-semibold text-zinc-800">Storage</span>
        <span className="text-zinc-600" aria-label={`${formatPercent(saved)} saved`}>
          <span className="text-lg font-semibold tabular-nums leading-none tracking-tight text-zinc-900">{formatPercent(shownSaved)}</span> saved
        </span>
      </div>
      <StorageBar label="Cortex" bytes={cortex} shownBytes={shownCortex} fraction={fraction} fill="bg-gradient-to-r from-sky-500 to-sky-600 shadow-[0_0_10px_rgba(14,165,233,0.35)]" track="bg-sky-900/10" percent={formatRatio(cortex, keepAll)} />
      <StorageBar label="Keep everything" bytes={keepAll} shownBytes={shownKeepAll} fraction={keepAll > 0 ? 1 : 0} fill="bg-gradient-to-r from-zinc-400 to-zinc-500" track="bg-zinc-900/10" percent={keepAll > 0 ? "100%" : "0%"} />
    </div>
  );
}
