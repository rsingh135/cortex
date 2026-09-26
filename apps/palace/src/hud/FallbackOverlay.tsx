"use client";
/** `F`: the recorded run, full-screen over everything. Esc or the button closes it. */
import { useEffect } from "react";
import { DEMO_ASSETS } from "@/lib/demo";
import { useFallbackOpen, usePalaceActions } from "@/lib/store";

export function FallbackOverlay() {
  const open = useFallbackOpen();
  const { setFallbackOpen } = usePalaceActions();
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setFallbackOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, setFallbackOpen]);
  if (!open) return null;
  return (
    <div className="pointer-events-auto fixed inset-0 z-30 flex items-center justify-center bg-black animate-page-in" role="dialog" aria-label="Recorded fallback">
      <video src={DEMO_ASSETS.fallbackVideo} autoPlay controls playsInline className="max-h-full max-w-full" />
      <button type="button" onClick={() => setFallbackOpen(false)} className="glass lift absolute right-4 top-4 rounded-full px-3.5 py-1.5 text-[13px] font-medium text-zinc-800 focus-visible:outline-2 focus-visible:outline-sky-600">
        Close (Esc)
      </button>
    </div>
  );
}
