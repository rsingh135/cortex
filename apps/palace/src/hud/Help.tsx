"use client";
/** Controls hint as a compact glass sheet. Dismissible (remembered in localStorage) or collapsed while a card is open; a "?" button brings it back. */
import { DEMO_KEYS } from "@/lib/demoKeys";
import { useControlsMode, usePalaceActions } from "@/lib/store";
import { setHelpDismissed, useHelpDismissed } from "./helpDismissed";

interface Hint {
  keys: string;
  does: string;
}

const WALK: Hint[] = [
  { keys: "Click", does: "look around" },
  { keys: "W A S D", does: "walk" },
  { keys: "Shift", does: "run" },
  { keys: "E", does: "fly through the door" },
  { keys: "Click object", does: "open its card" },
  { keys: "Tab", does: "orbit view" },
  { keys: "Esc", does: "release pointer" },
];

const ORBIT: Hint[] = [
  { keys: "Drag", does: "orbit" },
  { keys: "Scroll", does: "zoom" },
  { keys: "Right-drag", does: "pan" },
  { keys: "Click object", does: "open its card" },
  { keys: "Tab", does: "walk view" },
];

export interface HelpProps {
  /** Show only the "?" button (a selection card needs the room); the dismissed state is untouched. */
  compact?: boolean;
}

export function Help({ compact = false }: HelpProps) {
  const open = !useHelpDismissed() && !compact;
  const mode = useControlsMode();
  const { select } = usePalaceActions();
  const hints = mode === "walk" ? WALK : ORBIT;

  if (!open) {
    // While a card has the room, "?" closes the card to make space for the sheet.
    const show = () => {
      if (compact) select(null);
      setHelpDismissed(false);
    };
    return (
      <button type="button" onClick={show} aria-label="Show controls help" aria-expanded={false} className="glass lift flex h-10 w-10 items-center justify-center rounded-full text-base font-semibold text-zinc-700 hover:text-zinc-900 focus-visible:outline-2 focus-visible:outline-sky-600">
        ?
      </button>
    );
  }

  return (
    <aside className="glass w-64 rounded-2xl p-3 text-[13px] leading-5 animate-card-enter" aria-label="Controls">
      <div className="mb-2 flex items-center justify-between">
        <span className="font-semibold text-zinc-800">{mode === "walk" ? "Walk" : "Orbit"} controls</span>
        <button type="button" onClick={() => setHelpDismissed(true)} aria-label="Dismiss controls help" className="-mr-1 flex h-6 w-6 items-center justify-center rounded-md text-zinc-500 transition hover:bg-zinc-900/6 hover:text-zinc-900 focus-visible:outline-2 focus-visible:outline-sky-600">
          <span aria-hidden>×</span>
        </button>
      </div>
      <dl className="grid grid-cols-[auto_1fr] items-center gap-x-3 gap-y-1.5">
        {hints.map((h) => (
          <div key={h.keys} className="contents">
            <dt>
              <kbd className="inline-block rounded-md bg-white/80 px-1.5 py-px font-mono text-[11px] leading-4 text-zinc-700 shadow-[0_1px_0_rgba(24,24,27,0.14)] ring-1 ring-zinc-900/10">{h.keys}</kbd>
            </dt>
            <dd className="text-zinc-700">{h.does}</dd>
          </div>
        ))}
      </dl>
      <p className="mt-2.5 border-t border-zinc-900/8 pt-2 text-xs leading-4 text-zinc-600">Click a room on the map to fly there. Scrub the timeline to watch memory fade.</p>
      <details className="mt-2 border-t border-zinc-900/8 pt-2 text-xs leading-4 text-zinc-600">
        <summary className="cursor-pointer font-medium text-zinc-700">Demo keys</summary>
        <dl className="mt-1.5 grid grid-cols-[auto_1fr] items-center gap-x-3 gap-y-1">
          {DEMO_KEYS.map((h) => (
            <div key={h.keys} className="contents">
              <dt>
                <kbd className="inline-block rounded-md bg-white/80 px-1.5 py-px font-mono text-[11px] leading-4 text-zinc-700 shadow-[0_1px_0_rgba(24,24,27,0.14)] ring-1 ring-zinc-900/10">{h.keys}</kbd>
              </dt>
              <dd>{h.does}</dd>
            </div>
          ))}
        </dl>
      </details>
    </aside>
  );
}
