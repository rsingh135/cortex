"use client";
/**
 * Fixed overlay over the canvas. The container ignores pointer events so the scene keeps mouse
 * look and clicks; only the widgets themselves are interactive. The right edge is one column
 * (minimap, the selection card, the help sheet pinned at the bottom) so a tall card scrolls inside
 * the room it has rather than sliding under the help.
 */
import type { PalaceRoom } from "@/lib/layout";
import { useControlsMode, useSelectedId } from "@/lib/store";
import { ConnectionBadge } from "./ConnectionBadge";
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
  useDemoHotkeys();
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

      <div className="absolute inset-y-4 right-4 flex flex-col items-end gap-3">
        <div className={`${WIDGET} glass shrink-0 rounded-2xl p-2.5`}>
          <Minimap size={220} playerPosition={dot} onRoomClick={onRoomClick} />
          <MinimapLegend showPlayer={dot !== null} className="mt-1.5 justify-center" />
        </div>
        {/* Padding + negative margin keep the card's shadow inside the scroll box instead of clipping it. */}
        <Presence id={selectedId} className={`${WIDGET} -m-4 min-h-0 overflow-y-auto p-4`} render={(id) => <SelectionCard id={id} />} />
        <div className={`${WIDGET} mt-auto shrink-0`}>
          <Help compact={selectedId !== null} />
        </div>
      </div>

      <div className={`${WIDGET} absolute bottom-4 left-4 hidden md:block`}>
        <EventTicker />
      </div>
      <div className={`${WIDGET} absolute bottom-4 left-1/2 -translate-x-1/2`}>
        <Timeline />
      </div>
    </div>
  );
}
