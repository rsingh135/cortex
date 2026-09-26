"use client";
/**
 * Tab toggles walk/orbit while the scene has the keyboard; touch-first devices start in orbit. Used
 * once by `<Scene/>`. Tab is left alone whenever focus is inside the HUD (a button, the minimap, the
 * belief textarea) so keyboard users can still move through the overlay.
 */
import { useEffect } from "react";
import { usePalaceStore } from "@/lib/store";

/** True when the keyboard is "in the scene": nothing focused, or the canvas itself. */
function sceneHasKeyboard(target: EventTarget | null): boolean {
  const active = document.activeElement;
  const focusFree = active === null || active === document.body || active instanceof HTMLCanvasElement;
  const targetFree = target === null || target === document.body || target === document || target === window || target instanceof HTMLCanvasElement;
  return focusFree && targetFree;
}

export function useControlsHotkeys(): void {
  useEffect(() => {
    const store = usePalaceStore.getState();
    if (typeof window !== "undefined" && window.matchMedia?.("(pointer: coarse)").matches) store.setControlsMode("orbit");
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.code !== "Tab" || e.altKey || e.ctrlKey || e.metaKey) return;
      if (!sceneHasKeyboard(e.target)) return;
      e.preventDefault();
      const s = usePalaceStore.getState();
      s.setControlsMode(s.controlsMode === "walk" ? "orbit" : "walk");
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);
}
