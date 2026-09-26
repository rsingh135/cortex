"use client";
/** Cortex bytes vs keep-everything bytes: two bars on the same scale plus the saving. */
import { formatPercent, formatRatio } from "@/lib/format";
import { useBytes } from "@/lib/store";
import { StorageBar } from "./StorageBar";

export function StorageMeter() {
  const { cortex, keepAll } = useBytes();
  const fraction = keepAll > 0 ? Math.min(1, cortex / keepAll) : 0;
  const saved = keepAll > 0 ? Math.max(0, 1 - cortex / keepAll) : 0;
  return (
    <div className="w-72 rounded-xl bg-white/90 p-3 text-sm shadow-sm ring-1 ring-zinc-200 backdrop-blur" role="group" aria-label="Storage">
      <div className="mb-2 flex items-baseline justify-between">
        <span className="font-semibold text-zinc-800">Storage</span>
        <span className="text-zinc-600">
          <span className="font-semibold tabular-nums text-zinc-900">{formatPercent(saved)}</span> saved
        </span>
      </div>
      <StorageBar label="Cortex" bytes={cortex} fraction={fraction} fill="bg-sky-600" track="bg-sky-100" percent={formatRatio(cortex, keepAll)} />
      <StorageBar label="Keep everything" bytes={keepAll} fraction={keepAll > 0 ? 1 : 0} fill="bg-zinc-400" track="bg-zinc-200" percent={keepAll > 0 ? "100%" : "0%"} />
    </div>
  );
}
