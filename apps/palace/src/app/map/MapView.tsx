"use client";
/** Standalone 2D map: the floor plan large plus the agent's map JSON, live from the store. */
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { ConnectionBadge } from "@/hud/ConnectionBadge";
import { CheckIcon, CopyIcon } from "@/hud/icons";
import { Minimap } from "@/hud/Minimap";
import { MinimapLegend } from "@/hud/MinimapLegend";
import { Timeline } from "@/hud/Timeline";
import { tokenizeJson, type JsonTokenType } from "@/lib/jsonTokens";
import { agentMapJson } from "@/lib/map";
import { usePalaceStore, useRecentEvents, useSnapshot } from "@/lib/store";

const TOKEN_CLASS: Record<JsonTokenType, string | undefined> = {
  key: "text-sky-800",
  string: "text-zinc-800",
  number: "text-amber-700",
  literal: "text-violet-700",
  punctuation: "text-zinc-500",
  whitespace: undefined,
};

const COPIED_MS = 1800;

export function MapView() {
  const snapshot = useSnapshot();
  const recentEvents = useRecentEvents();
  const json = useMemo(() => agentMapJson(snapshot, recentEvents), [snapshot, recentEvents]);
  const tokens = useMemo(() => tokenizeJson(json), [json]);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    usePalaceStore.getState().connect();
    return () => usePalaceStore.getState().disconnect();
  }, []);

  useEffect(() => {
    if (!copied) return;
    const handle = setTimeout(() => setCopied(false), COPIED_MS);
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
    <main className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-6 px-4 py-6 text-[13px] leading-5 text-zinc-900 animate-page-in sm:px-6">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Agent map</h1>
          <p className="mt-1 text-sm text-zinc-600">The floor plan Maya walks, and the ~500-token JSON the agent reads before recalling anything.</p>
        </div>
        <div className="flex items-center gap-3">
          <ConnectionBadge />
          <Link href="/palace" className="lift rounded-lg bg-zinc-900 px-3.5 py-2 text-[13px] font-medium text-white hover:bg-zinc-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-600">
            Enter the palace
          </Link>
        </div>
      </header>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        <section aria-labelledby="floor-plan" className="glass flex flex-col items-center gap-4 rounded-2xl p-5">
          <h2 id="floor-plan" className="self-start text-sm font-semibold text-zinc-800">
            Floor plan
          </h2>
          <Minimap size={560} playerPosition={null} className="max-w-full" />
          <MinimapLegend showPlayer={false} showRooms className="justify-center" />
          <Timeline />
        </section>

        <section aria-labelledby="map-json" className="glass flex min-w-0 flex-col rounded-2xl p-5">
          <div className="mb-3 flex items-center justify-between gap-3">
            <h2 id="map-json" className="flex items-center gap-2 text-sm font-semibold text-zinc-800">
              <span className="rounded-md bg-zinc-900/6 px-1.5 py-0.5 font-mono text-xs font-medium text-zinc-700">GET</span>
              /map
              <span className="font-normal tabular-nums text-zinc-600">~{Math.ceil(json.length / 4)} tokens</span>
            </h2>
            <button type="button" onClick={copy} className={`lift inline-flex h-8 items-center gap-1.5 rounded-lg px-2.5 text-xs font-medium ring-1 ring-inset focus-visible:outline-2 focus-visible:outline-sky-600 ${copied ? "bg-emerald-50 text-emerald-800 ring-emerald-300" : "bg-white/70 text-zinc-700 ring-zinc-900/10 hover:bg-white hover:text-zinc-900"}`} aria-live="polite">
              <span key={copied ? "check" : "copy"} className="inline-flex animate-pop">
                {copied ? <CheckIcon /> : <CopyIcon />}
              </span>
              {copied ? "Copied" : "Copy JSON"}
            </button>
          </div>
          <pre className="min-h-0 flex-1 overflow-auto rounded-xl bg-white/80 p-4 font-mono text-[12px] leading-5 text-zinc-800 shadow-[inset_0_0_0_1px_rgba(24,24,27,0.08)]" tabIndex={0} aria-label="Agent map JSON">
            {tokens.map((t, i) =>
              TOKEN_CLASS[t.type] ? (
                <span key={i} className={TOKEN_CLASS[t.type]}>
                  {t.text}
                </span>
              ) : (
                t.text
              ),
            )}
          </pre>
        </section>
      </div>
    </main>
  );
}
