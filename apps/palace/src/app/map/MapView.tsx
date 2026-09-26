"use client";
/** Standalone 2D map: the floor plan large plus the agent's map JSON, live from the store. */
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { ConnectionBadge } from "@/hud/ConnectionBadge";
import { Minimap } from "@/hud/Minimap";
import { MinimapLegend } from "@/hud/MinimapLegend";
import { Timeline } from "@/hud/Timeline";
import { agentMapJson } from "@/lib/map";
import { usePalaceStore, useRecentEvents, useSnapshot } from "@/lib/store";

export function MapView() {
  const snapshot = useSnapshot();
  const recentEvents = useRecentEvents();
  const json = useMemo(() => agentMapJson(snapshot, recentEvents), [snapshot, recentEvents]);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    usePalaceStore.getState().connect();
    return () => usePalaceStore.getState().disconnect();
  }, []);

  useEffect(() => {
    if (!copied) return;
    const handle = setTimeout(() => setCopied(false), 1500);
    return () => clearTimeout(handle);
  }, [copied]);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(json);
      setCopied(true);
    } catch {
      setCopied(false);
    }
  };

  return (
    <main className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-6 px-4 py-6 text-zinc-900 sm:px-6">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Agent map</h1>
          <p className="mt-1 text-sm text-zinc-600">The floor plan Maya walks, and the ~500-token JSON the agent reads before recalling anything.</p>
        </div>
        <div className="flex items-center gap-3">
          <ConnectionBadge />
          <Link href="/" className="rounded-md bg-zinc-900 px-3 py-1.5 text-xs font-medium text-white hover:bg-zinc-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-600">
            Enter the palace
          </Link>
        </div>
      </header>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        <section aria-labelledby="floor-plan" className="flex flex-col items-center gap-4 rounded-2xl bg-white p-4 ring-1 ring-zinc-200">
          <h2 id="floor-plan" className="self-start text-sm font-semibold text-zinc-700">
            Floor plan
          </h2>
          <Minimap size={560} playerPosition={null} className="max-w-full" />
          <MinimapLegend showPlayer={false} />
          <Timeline />
        </section>

        <section aria-labelledby="map-json" className="flex min-w-0 flex-col rounded-2xl bg-white p-4 ring-1 ring-zinc-200">
          <div className="mb-3 flex items-center justify-between gap-3">
            <h2 id="map-json" className="text-sm font-semibold text-zinc-700">
              GET /map
              <span className="ml-2 font-normal text-zinc-500">~{Math.ceil(json.length / 4)} tokens</span>
            </h2>
            <button type="button" onClick={copy} className="rounded-md px-2.5 py-1 text-xs font-medium text-zinc-700 ring-1 ring-inset ring-zinc-200 hover:bg-zinc-100 focus-visible:outline-2 focus-visible:outline-sky-600" aria-live="polite">
              {copied ? "Copied" : "Copy JSON"}
            </button>
          </div>
          <pre className="min-h-0 flex-1 overflow-auto rounded-lg bg-zinc-50 p-3 font-mono text-[12px] leading-5 text-zinc-800 ring-1 ring-inset ring-zinc-200" tabIndex={0} aria-label="Agent map JSON">
            {json}
          </pre>
        </section>
      </div>
    </main>
  );
}
