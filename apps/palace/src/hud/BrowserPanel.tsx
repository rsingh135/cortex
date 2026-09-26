"use client";
/**
 * Split view for the live hunt: the mock world in an iframe on the right, with the agent's last few
 * procedure steps in the toolbar. Toggled with `B`; opens itself when drafts or steps arrive.
 */
import { useMemo } from "react";
import { useBrowserOpen, usePalaceActions, useRecentEvents } from "@/lib/store";

export const MOCKWORLD_URL = process.env.NEXT_PUBLIC_MOCKWORLD_URL ?? "http://localhost:3000";
export const BROWSER_PANEL_WIDTH = "46vw";

export function BrowserPanel() {
  const open = useBrowserOpen();
  const { setBrowserOpen } = usePalaceActions();
  const recent = useRecentEvents();
  const steps = useMemo(
    () =>
      recent
        .filter((e) => e.type === "procedure.step")
        .slice(0, 5)
        .map((e) => (e.type === "procedure.step" ? `step ${e.payload.step} · ${e.payload.do}${e.payload.listing_id ? ` · ${e.payload.listing_id}` : ""}` : "")),
    [recent],
  );
  if (!open) return null;
  return (
    <aside className="pointer-events-auto glass-strong animate-card-enter absolute inset-y-4 right-4 flex flex-col overflow-hidden rounded-2xl" style={{ width: BROWSER_PANEL_WIDTH }} aria-label="Live browser">
      <div className="flex items-center gap-2 border-b border-zinc-900/8 px-3 py-2 text-xs">
        <span className="rounded-md bg-zinc-900/6 px-1.5 py-0.5 font-mono text-[11px] font-medium text-zinc-700">agent</span>
        <span className="truncate font-mono text-zinc-600" title={MOCKWORLD_URL}>
          {MOCKWORLD_URL.replace(/^https?:\/\//, "")}
        </span>
        <div className="ml-auto flex min-w-0 items-center gap-1.5 overflow-hidden">
          {steps.length ? (
            <span className="truncate rounded-full bg-sky-50 px-2 py-0.5 text-[11px] font-medium text-sky-900 ring-1 ring-inset ring-sky-200" title={steps.join("\n")}>
              {steps[0]}
            </span>
          ) : (
            <span className="text-zinc-500">waiting for the agent</span>
          )}
          <button type="button" onClick={() => setBrowserOpen(false)} aria-label="Close browser panel" className="ml-1 flex h-6 w-6 shrink-0 items-center justify-center rounded-md text-zinc-500 transition hover:bg-zinc-900/6 hover:text-zinc-900 focus-visible:outline-2 focus-visible:outline-sky-600">
            <span aria-hidden>×</span>
          </button>
        </div>
      </div>
      <iframe src={MOCKWORLD_URL} title="Mock world" className="h-full w-full flex-1 bg-white" />
    </aside>
  );
}
