"use client";
/**
 * Beat 5: the closing chart. Live mode asks the engine for `/stats` per strategy and falls back to
 * the simulated series when the engine has nothing yet; fixture mode always simulates.
 */
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { StatsResponse } from "@cortex/schema";
import { ConnectionBadge } from "@/hud/ConnectionBadge";
import { CHART_SERIES, CHART_SIZE, renderChartBody, rowsFromStats, simulatedRows, type AccuracyRow, type DayRow } from "@/lib/chart";
import { ENGINE_URL, detectMode, usePalaceStore, useWorkflowScore } from "@/lib/store";

type Source = "engine" | "simulated";

interface ChartData {
  rows: DayRow[];
  accuracy: AccuracyRow[] | null;
  source: Source;
}

async function loadEngineStats(): Promise<ChartData | null> {
  if (!ENGINE_URL) return null;
  try {
    const all = await Promise.all(
      CHART_SERIES.map(async (se) => {
        const res = await fetch(`${ENGINE_URL}/stats?condition=${se.condition}`);
        if (!res.ok) return [];
        return StatsResponse.parse(await res.json()).rows;
      }),
    );
    const { rows, accuracy } = rowsFromStats(all.flat());
    if (rows.length < 2) return null;
    return { rows, accuracy, source: "engine" };
  } catch {
    return null;
  }
}

export function ChartView() {
  const [data, setData] = useState<ChartData>({ rows: simulatedRows(), accuracy: null, source: "simulated" });
  const score = useWorkflowScore();

  useEffect(() => {
    usePalaceStore.getState().connect();
    if (detectMode() === "live") {
      void loadEngineStats().then((d) => {
        if (d) setData(d);
      });
    }
    return () => usePalaceStore.getState().disconnect();
  }, []);

  const body = useMemo(() => renderChartBody(data.rows, data.accuracy), [data]);
  const withMemory = score ? `${score.withMemory.right} of ${score.withMemory.of}` : "— of 6";
  const noMemory = score ? `${score.noMemory.right} of ${score.noMemory.of}` : "— of 6";

  return (
    <main className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-6 px-4 py-6 text-[13px] leading-5 text-zinc-900 animate-page-in sm:px-6">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">The proof</h1>
          <p className="mt-1 text-sm text-zinc-600">Bytes stored and weighted answer accuracy over Maya&apos;s month, one line per memory strategy.</p>
        </div>
        <div className="flex items-center gap-3">
          <ConnectionBadge />
          <Link href="/palace" className="lift rounded-lg bg-zinc-900 px-3.5 py-2 text-[13px] font-medium text-white hover:bg-zinc-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-600">
            Enter the palace
          </Link>
        </div>
      </header>

      <section aria-label="Bytes stored and accuracy chart" className="glass flex flex-col gap-4 rounded-2xl p-5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-sm font-semibold text-zinc-800">Accuracy per byte</h2>
          <span className="rounded-full bg-zinc-900/6 px-2.5 py-0.5 text-xs font-medium text-zinc-700 ring-1 ring-inset ring-zinc-900/10" title={data.source === "engine" ? "Rows from the engine's daily ledger" : "Simulated from the spec's parameters; the engine ledger replaces this once the month is ingested"}>
            {data.source === "engine" ? "engine ledger" : "simulated series"}
          </span>
        </div>
        <svg viewBox={`0 0 ${CHART_SIZE.width} ${CHART_SIZE.height}`} className="h-auto w-full rounded-xl" role="img" aria-label="Two panels over simulated days: bytes stored on top, weighted accuracy below, for keep everything, blur by age and Cortex" fontFamily="system-ui, -apple-system, Segoe UI, sans-serif" dangerouslySetInnerHTML={{ __html: body }} />
        <p className="border-t border-zinc-900/8 pt-3 text-sm text-zinc-700">
          <span className="font-semibold text-zinc-900">Live hunt:</span> <span className="tabular-nums">{withMemory}</span> decisions right
          <span className="mx-2 text-zinc-400">·</span>
          <span className="font-semibold text-zinc-900">No memory:</span> <span className="tabular-nums">{noMemory}</span>
        </p>
      </section>
    </main>
  );
}
