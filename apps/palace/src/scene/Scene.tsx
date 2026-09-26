"use client";
/**
 * Canvas + building + controls + flight driver. Drop objects (pedestals, paintings, threads) in as
 * children; they render inside the same Canvas. A click on empty space (walls, floor, sky) grabs
 * the pointer in walk mode and reports a miss so the page can clear the selection.
 */
import { useCallback, type ReactNode } from "react";
import { usePalaceStore } from "@/lib/store";
import { Architecture } from "./Architecture";
import { DoorFly } from "./DoorFly";
import { FirstPersonControls, type FirstPersonControlsProps } from "./FirstPersonControls";
import { OrbitFallback } from "./OrbitFallback";
import { PalaceCanvas } from "./PalaceCanvas";
import { useControlsHotkeys } from "./useControlsHotkeys";

export interface SceneProps {
  children?: ReactNode;
  className?: string;
  controls?: FirstPersonControlsProps;
  /** Font URL for the room lettering (drei `<Text>`); the default fetches troika's bundled font. */
  font?: string;
  /** A click that hit no interactive object; deselect here. */
  onPointerMissed?: (event: MouseEvent) => void;
}

export function Scene({ children, className, controls, font, onPointerMissed }: SceneProps) {
  useControlsHotkeys();
  const handleMissed = useCallback(
    (event: MouseEvent) => {
      onPointerMissed?.(event);
      const canvas = event.currentTarget instanceof HTMLCanvasElement ? event.currentTarget : event.target instanceof HTMLCanvasElement ? event.target : null;
      if (!canvas || usePalaceStore.getState().controlsMode !== "walk") return;
      if (document.pointerLockElement !== canvas) canvas.requestPointerLock?.();
    },
    [onPointerMissed],
  );
  return (
    <PalaceCanvas className={className} onPointerMissed={handleMissed}>
      <Architecture font={font} />
      <FirstPersonControls {...controls} />
      <OrbitFallback />
      <DoorFly />
      {children}
    </PalaceCanvas>
  );
}
