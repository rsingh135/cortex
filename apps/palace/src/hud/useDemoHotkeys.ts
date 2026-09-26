"use client";
/**
 * Global demo hotkeys from docs/demo.md. Skips text fields and leaves Tab / Esc / E to the scene
 * controls (`useControlsHotkeys`). Used once by `<Hud/>`.
 */
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { approveAllDrafts, openFallback, playDreamJournal, sendVoiceFallback } from "@/lib/demo";
import { demoActionFor, isTypingTarget } from "@/lib/demoKeys";
import { usePalaceStore } from "@/lib/store";

export function useDemoHotkeys(): void {
  const router = useRouter();
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.repeat || isTypingTarget(e.target)) return;
      const action = demoActionFor(e);
      if (!action) return;
      e.preventDefault();
      const store = usePalaceStore.getState();
      switch (action) {
        case "replay.start":
          void store.startReplay();
          store.toast("Replaying day 2");
          return;
        case "replay.stop":
          store.stopReplay();
          store.toast("Replay stopped");
          return;
        case "journal":
          void playDreamJournal();
          return;
        case "chart":
          router.push("/chart");
          return;
        case "fallback":
          if (store.fallbackOpen) store.setFallbackOpen(false);
          else void openFallback();
          return;
        case "voice":
          void sendVoiceFallback();
          return;
        case "approve":
          void approveAllDrafts();
          return;
        case "browser":
          store.setBrowserOpen(!store.browserOpen);
          return;
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [router]);
}
