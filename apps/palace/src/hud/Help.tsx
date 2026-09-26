"use client";
/** Controls hint. Dismissible (remembered in localStorage); a "?" button brings it back. */
import { useControlsMode } from "@/lib/store";
import { setHelpDismissed, useHelpDismissed } from "./helpDismissed";

interface Hint {
  keys: string;
  does: string;
}

const WALK: Hint[] = [
  { keys: "Click", does: "grab the mouse to look around" },
  { keys: "W A S D", does: "walk" },
  { keys: "Shift", does: "run" },
  { keys: "E", does: "fly through the door ahead" },
  { keys: "Click object", does: "open its card" },
  { keys: "Tab", does: "switch to orbit view" },
  { keys: "Esc", does: "release the pointer" },
];

const ORBIT: Hint[] = [
  { keys: "Drag", does: "orbit" },
  { keys: "Scroll / pinch", does: "zoom" },
  { keys: "Right-drag / two fingers", does: "pan" },
  { keys: "Click object", does: "open its card" },
  { keys: "Tab", does: "switch to walk view" },
];

export function Help() {
  const open = !useHelpDismissed();
  const mode = useControlsMode();
  const hints = mode === "walk" ? WALK : ORBIT;

  if (!open) {
    return (
      <button type="button" onClick={() => setHelpDismissed(false)} aria-label="Show controls help" aria-expanded={false} className="flex h-10 w-10 items-center justify-center rounded-full bg-white/90 text-base font-semibold text-zinc-700 shadow-sm ring-1 ring-zinc-200 backdrop-blur hover:bg-white focus-visible:outline-2 focus-visible:outline-sky-600">
        ?
      </button>
    );
  }

  return (
    <aside className="w-72 rounded-xl bg-white/90 p-3 text-sm shadow-sm ring-1 ring-zinc-200 backdrop-blur" aria-label="Controls">
      <div className="mb-2 flex items-center justify-between">
        <span className="font-semibold text-zinc-800">{mode === "walk" ? "Walk" : "Orbit"} controls</span>
        <button type="button" onClick={() => setHelpDismissed(true)} aria-label="Dismiss controls help" className="-mr-1 flex h-6 w-6 items-center justify-center rounded text-zinc-500 hover:bg-zinc-100 hover:text-zinc-900 focus-visible:outline-2 focus-visible:outline-sky-600">
          <span aria-hidden>×</span>
        </button>
      </div>
      <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1">
        {hints.map((h) => (
          <div key={h.keys} className="contents">
            <dt>
              <kbd className="rounded border border-zinc-300 bg-zinc-50 px-1 py-px font-mono text-xs text-zinc-700">{h.keys}</kbd>
            </dt>
            <dd className="text-zinc-600">{h.does}</dd>
          </div>
        ))}
      </dl>
      <p className="mt-2 text-xs leading-4 text-zinc-500">Click a room on the map to fly there. Scrub the timeline to watch memory fade.</p>
    </aside>
  );
}
