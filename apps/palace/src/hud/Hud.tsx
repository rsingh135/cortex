"use client";
/**
 * Fixed overlay over the canvas. The container ignores pointer events so the scene keeps mouse
 * look and clicks; only the widgets themselves are interactive. The right edge is one column
 * (minimap, the selection card, the help sheet pinned at the bottom) so a tall card scrolls inside
 * the room it has rather than sliding under the help.
 */
import type { PalaceRoom } from "@/lib/layout";
import { useBrowserOpen, useControlsMode, useDrafts, useSelectedId } from "@/lib/store";
import { BrowserPanel, BROWSER_PANEL_WIDTH } from "./BrowserPanel";
import { ConnectionBadge } from "./ConnectionBadge";
import { DraftCard } from "./DraftCard";
import { EventTicker } from "./EventTicker";
import { FallbackOverlay } from "./FallbackOverlay";
import { Help } from "./Help";
import { Minimap } from "./Minimap";
import { MinimapLegend } from "./MinimapLegend";
import { PointerHint } from "./PointerHint";
import { Presence } from "./Presence";
import { ReplayChip } from "./ReplayChip";
import { SelectionCard } from "./SelectionCard";
import { StorageMeter } from "./StorageMeter";
import { Timeline } from "./Timeline";
import { Toasts } from "./Toast";
import { useDemoHotkeys } from "./useDemoHotkeys";

export interface HudProps {
  /** Minimap room click, e.g. fly the camera to that room's door. */
  onRoomClick?: (room: PalaceRoom) => void;
  /** Override the you-are-here dot; by default it follows `setPlayerPosition`. */
  playerPosition?: [number, number] | null;
}

const WIDGET = "pointer-events-auto";

export function Hud({ onRoomClick, playerPosition }: HudProps) {
  // In orbit mode the camera hangs above the palace; a you-are-here dot would be meaningless.
  const orbiting = useControlsMode() === "orbit";
  const dot = orbiting ? null : playerPosition;
  const selectedId = useSelectedId();
  const browserOpen = useBrowserOpen();
  const hasDrafts = useDrafts().length > 0;
  useDemoHotkeys();
  // With the browser on the right edge, everything else lives in the left half: the timeline recentres there,
  // and the minimap and help step aside so the draft card has the column.
  const leftHalfCentre = browserOpen ? `calc((100vw - ${BROWSER_PANEL_WIDTH} - 2rem) / 2)` : "50%";
  return (
    <div className="pointer-events-none fixed inset-0 z-10 font-sans text-[13px] leading-5 text-zinc-900" aria-label="Palace overlay">
      <PointerHint />
      <Toasts />
      <FallbackOverlay />
      <div className="absolute left-4 top-4 flex flex-col items-start gap-2.5">
        <div className={`${WIDGET} flex flex-wrap items-center gap-2`}>
          <ConnectionBadge />
          <ReplayChip />
        </div>
        <div className={WIDGET}>
          <StorageMeter />
        </div>
      </div>

      <BrowserPanel />
      {/* The right column slides left when the browser panel takes the right edge. */}
      <div className="absolute inset-y-4 flex flex-col items-end gap-3 transition-[right] duration-300 ease-out" style={{ right: browserOpen ? `calc(${BROWSER_PANEL_WIDTH} + 2rem)` : "1rem" }}>
        {browserOpen ? null : (
          <div className={`${WIDGET} glass shrink-0 rounded-2xl p-2.5`}>
            <Minimap size={220} playerPosition={dot} onRoomClick={onRoomClick} />
            <MinimapLegend showPlayer={dot !== null} className="mt-1.5 justify-center" />
          </div>
        )}
        {/* Padding + negative margin keep the card's shadow inside the scroll box instead of clipping it. */}
        <div className={`${WIDGET} shrink-0`}>
          <DraftCard />
        </div>
        <Presence id={selectedId} className={`${WIDGET} -m-4 min-h-0 overflow-y-auto p-4`} render={(id) => <SelectionCard id={id} />} />
        <div className={`${WIDGET} mt-auto shrink-0`}>
          <Help compact={selectedId !== null || hasDrafts || browserOpen} />
        </div>
      </div>

      {browserOpen ? null : (
        <div className={`${WIDGET} absolute bottom-4 left-4 hidden md:block`}>
          <EventTicker />
        </div>
      )}
      <div className={`${WIDGET} absolute bottom-4 -translate-x-1/2 transition-[left] duration-300 ease-out`} style={{ left: leftHalfCentre }}>
        <Timeline />
      </div>
    </div>
  );
}
