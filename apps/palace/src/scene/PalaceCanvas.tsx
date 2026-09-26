"use client";
/**
 * The R3F canvas: soft daylight, shadows, sRGB output, a gradient sky. Children are scene objects.
 * While the pointer is locked (walk mode) the raycaster fires from the screen centre, so hover and
 * click land on whatever the crosshair points at instead of wherever the cursor was frozen.
 */
import { Canvas, events as createPointerEvents, type EventManager, type RootState, type RootStore } from "@react-three/fiber";
import type { ReactNode } from "react";
import { ACESFilmicToneMapping, SRGBColorSpace } from "three";
import { EYE_HEIGHT } from "@/lib/layout";
import { Daylight } from "./Daylight";
import { PALETTE } from "./materials";
import { SkyDome } from "./SkyDome";

export interface PalaceCanvasProps {
  children?: ReactNode;
  className?: string;
  /** A click that hit no interactive object (walls and floors do not count). */
  onPointerMissed?: (event: MouseEvent) => void;
}

/** 6.5 m from the Housing door, facing it: the first frame shows a labelled door, pedestals and objects. */
export const DEFAULT_SPAWN: [number, number, number] = [2.5, EYE_HEIGHT, 0];

type DomPointerEvent = Parameters<NonNullable<EventManager<HTMLElement>["compute"]>>[0];

function computePointer(event: DomPointerEvent, state: RootState): void {
  const locked = typeof document !== "undefined" && document.pointerLockElement === state.gl.domElement;
  if (locked) state.pointer.set(0, 0);
  else state.pointer.set((event.offsetX / state.size.width) * 2 - 1, -(event.offsetY / state.size.height) * 2 + 1);
  state.raycaster.setFromCamera(state.pointer, state.camera);
}

function eventManager(store: RootStore): EventManager<HTMLElement> {
  return { ...createPointerEvents(store), compute: computePointer };
}

export function PalaceCanvas({ children, className, onPointerMissed }: PalaceCanvasProps) {
  return (
    <Canvas
      className={className}
      shadows="soft"
      dpr={[1, 2]}
      camera={{ fov: 70, near: 0.05, far: 400, position: DEFAULT_SPAWN }}
      gl={{ antialias: true, toneMapping: ACESFilmicToneMapping, toneMappingExposure: 1.15, outputColorSpace: SRGBColorSpace }}
      events={eventManager}
      onPointerMissed={onPointerMissed}
      style={{ width: "100%", height: "100%", display: "block", touchAction: "none" }}
    >
      <color attach="background" args={[PALETTE.skyHorizon]} />
      <fog attach="fog" args={[PALETTE.skyHorizon, 45, 160]} />
      <Daylight />
      <SkyDome />
      {children}
    </Canvas>
  );
}
