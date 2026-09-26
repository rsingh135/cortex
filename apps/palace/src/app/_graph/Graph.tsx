"use client";
/**
 * The belief graph page: dark open space, six clusters, walk or orbit through them, the same HUD
 * (minus the minimap) and the same store as the room palace, so replay, live mode and hotkeys work.
 */
import { useCallback, useEffect } from "react";
import { Hud } from "@/hud";
import { graphSpawn } from "@/lib/graphLayout";
import { usePalaceStore } from "@/lib/store";
import { BeliefGraph, GraphCanvas } from "@/graph3d";
import { FirstPersonControls, OrbitFallback, useControlsHotkeys } from "@/scene";

const FONT_URL = "/fonts/Geist-Regular.ttf";

export function Graph() {
  useControlsHotkeys();
  useEffect(() => {
    usePalaceStore.getState().connect();
    return () => usePalaceStore.getState().disconnect();
  }, []);
  const spawn = graphSpawn();
  const handleMissed = useCallback((event: MouseEvent) => {
    usePalaceStore.getState().select(null);
    const canvas = event.target instanceof HTMLCanvasElement ? event.target : null;
    if (!canvas || usePalaceStore.getState().controlsMode !== "walk") return;
    if (document.pointerLockElement !== canvas) canvas.requestPointerLock?.();
  }, []);

  return (
    <div data-theme="dark" className="contents">
      <div className="fixed inset-0 overflow-hidden bg-[#0e0f12]" aria-label="Memory palace">
        <GraphCanvas onPointerMissed={handleMissed}>
          <FirstPersonControls spawn={spawn.position} spawnYaw={spawn.yaw} noCollision />
          <OrbitFallback />
          <BeliefGraph font={FONT_URL} />
        </GraphCanvas>
      </div>
      <Hud showMinimap={false} />
    </div>
  );
}
