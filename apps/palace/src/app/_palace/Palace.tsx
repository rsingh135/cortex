"use client";
/**
 * The composed palace: scene + memory objects inside one Canvas, the HUD overlaid, the store
 * connected for the page's lifetime (fixture by default; live when NEXT_PUBLIC_LIVE_SERVER_WS_URL
 * is set). A click on empty space clears the selection; the minimap flies the camera to a room.
 */
import { useCallback, useEffect } from "react";
import { Hud } from "@/hud";
import { usePalaceStore } from "@/lib/store";
import { MemoryObjects } from "@/objects";
import { Scene, flyTo } from "@/scene";
import { PlayerTracker } from "./PlayerTracker";

/** Self-hosted so drei `<Text>` never reaches for a CDN font (works offline). */
const FONT_URL = "/fonts/Geist-Regular.ttf";

export function Palace() {
  useEffect(() => {
    usePalaceStore.getState().connect();
    return () => usePalaceStore.getState().disconnect();
  }, []);

  const deselect = useCallback(() => usePalaceStore.getState().select(null), []);

  return (
    <>
      <div className="fixed inset-0 overflow-hidden bg-[#f6f5f2]" aria-label="Memory palace">
        <Scene font={FONT_URL} onPointerMissed={deselect}>
          <MemoryObjects font={FONT_URL} />
          <PlayerTracker />
        </Scene>
      </div>
      <Hud onRoomClick={flyTo} />
    </>
  );
}
