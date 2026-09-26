"use client";
/**
 * The composed palace: scene + memory objects inside one Canvas, the HUD overlaid, the store
 * connected for the page's lifetime (fixture by default; live when NEXT_PUBLIC_LIVE_SERVER_WS_URL
 * is set). A click on empty space clears the selection; the minimap flies the camera to a room.
 */
import type { WsEvent } from "@cortex/schema";
import { useCallback, useEffect } from "react";
import { Hud } from "@/hud";
import { usePalaceStore } from "@/lib/store";
import { MemoryObjects } from "@/objects";
import { Scene, flyTo } from "@/scene";
import { PlayerTracker } from "./PlayerTracker";

/** Self-hosted so drei `<Text>` never reaches for a CDN font (works offline). */
const FONT_URL = "/fonts/Geist-Regular.ttf";

/** `?demo=drafts` injects a sample approval request two seconds after connect, for rehearsing beat 3 without the engine. */
function sampleDrafts(): WsEvent {
  const s = usePalaceStore.getState().snapshot;
  const rules = s.beliefs.filter((b) => b.kind === "preference" && b.room === "Housing" && b.status === "active" && !b.inferred).slice(0, 3).map((b) => b.id);
  return {
    id: "demo_drafts",
    day: s.day,
    ts: new Date().toISOString(),
    condition: "cortex",
    type: "agent.drafts",
    payload: {
      run_id: "demo_run",
      drafts: [
        { draft_id: "demo_d1", listing_id: "listing:305", listing_title: "Sunny 1BR in Bushwick", to: "Dana Whitfield", text: "Hi Dana! I'm Maya, moving to New York Sept 1 for a new job near Union Square. Is the sunny 1BR still available? Does the building have laundry? I'd love to see it this week if possible. Thanks!", because: rules },
        { draft_id: "demo_d2", listing_id: "listing:306", listing_title: "Quiet 1BR in Ridgewood", to: "Omar Haddad", text: "Hi Omar! I'm Maya, moving Sept 1 for a job near Union Square. Is the quiet 1BR in Ridgewood still available, and is there laundry in the building? Could I see it this week?", because: rules.slice(0, 2) },
      ],
    },
  };
}

export function Palace() {
  useEffect(() => {
    usePalaceStore.getState().connect();
    const wantsDrafts = new URLSearchParams(window.location.search).get("demo") === "drafts";
    const handle = wantsDrafts ? setTimeout(() => usePalaceStore.getState().applyEvent(sampleDrafts()), 2000) : null;
    return () => {
      if (handle) clearTimeout(handle);
      usePalaceStore.getState().disconnect();
    };
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
