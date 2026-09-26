"use client";
/**
 * Walk-mode affordances: a crosshair dot while the mouse is grabbed (the raycaster fires from the
 * screen centre then), and a "click to look around" hint while it is not. The hint sits low, above
 * the timeline, so it never covers what the crosshair is pointing at. Touch devices are in orbit
 * mode and see neither.
 */
import { useControlsMode, usePointerLocked } from "@/lib/store";

export function PointerHint() {
  const mode = useControlsMode();
  const locked = usePointerLocked();
  if (mode !== "walk") return null;
  if (locked) {
    return (
      <div aria-hidden className="absolute left-1/2 top-1/2 h-2 w-2 -translate-x-1/2 -translate-y-1/2 rounded-full bg-white/90 shadow-[0_0_0_1.5px_rgba(24,24,27,0.55)]" />
    );
  }
  return (
    <div className="absolute inset-x-0 bottom-40 flex justify-center">
      <p className="rounded-full bg-white/85 px-4 py-1.5 text-sm font-medium text-zinc-700 shadow-sm ring-1 ring-zinc-200 backdrop-blur">Click the scene to look around · W A S D to walk · Tab for orbit</p>
    </div>
  );
}
