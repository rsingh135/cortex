"use client";
/**
 * Fixed overlay over the canvas. The container ignores pointer events so the scene keeps mouse
 * look and clicks; only the widgets themselves are interactive.
 */
import type { PalaceRoom } from "@/lib/layout";
import { useControlsMode } from "@/lib/store";
import { ConnectionBadge } from "./ConnectionBadge";
import { EventTicker } from "./EventTicker";
import { Help } from "./Help";
import { Minimap } from "./Minimap";
import { MinimapLegend } from "./MinimapLegend";
import { PointerHint } from "./PointerHint";
import { SelectionCard } from "./SelectionCard";
import { StorageMeter } from "./StorageMeter";
import { Timeline } from "./Timeline";

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
  return (
    <div className="pointer-events-none fixed inset-0 z-10 font-sans text-sm text-zinc-900" aria-label="Palace overlay">
      <PointerHint />
      <div className="absolute left-4 top-4 flex flex-col items-start gap-2">
        <div className={WIDGET}>
          <ConnectionBadge />
        </div>
        <div className={WIDGET}>
          <StorageMeter />
        </div>
      </div>

      <div className="absolute right-4 top-4 flex flex-col items-end gap-3">
        <div className={`${WIDGET} rounded-xl bg-white/90 p-2 shadow-sm ring-1 ring-zinc-200 backdrop-blur`}>
          <Minimap size={220} playerPosition={dot} onRoomClick={onRoomClick} />
          <MinimapLegend showPlayer={dot !== null} className="mt-1.5 justify-center" />
        </div>
        <div className={`${WIDGET} max-h-[calc(100vh-16rem)] overflow-y-auto rounded-xl`}>
          <SelectionCard />
        </div>
      </div>

      <div className="absolute inset-x-4 bottom-4 flex flex-wrap items-end justify-between gap-3">
        <div className={`${WIDGET} order-1 hidden md:block`}>
          <EventTicker />
        </div>
        <div className={`${WIDGET} order-3 mx-auto md:order-2`}>
          <Timeline />
        </div>
        <div className={`${WIDGET} order-2 ml-auto md:order-3`}>
          <Help />
        </div>
      </div>
    </div>
  );
}
