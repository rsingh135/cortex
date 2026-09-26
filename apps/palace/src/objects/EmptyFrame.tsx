"use client";
/**
 * A forgotten capture: the frame stays on the wall around a blank plaster canvas, with a small
 * "forgotten" plaque underneath. Still selectable so the HUD can explain what was here.
 */
import type { ThreeEvent } from "@react-three/fiber";
import { useIsHovered, useIsSelected, usePalaceActions, usePalaceStore } from "@/lib/store";
import type { Placement } from "@/lib/types";
import { frameGeometries } from "./Painting";
import { FORGOTTEN_CANVAS, FRAME_BORDER, FRAME_DEPTH, HOVER_EMISSIVE, PAINTING_HEIGHT, PLAQUE_HEIGHT, PLASTER_SHADOW, SELECT_EMISSIVE } from "./palette";
import { Plaque } from "./Plaque";

export interface EmptyFrameProps {
  id: string;
  placement: Placement;
  /** Optional font URL for the plaque text. */
  font?: string;
}

export function EmptyFrame({ id, placement, font }: EmptyFrameProps) {
  const selected = useIsSelected(id);
  const hovered = useIsHovered(id);
  const { select, hover } = usePalaceActions();
  const geometries = frameGeometries();

  const onClick = (e: ThreeEvent<MouseEvent>) => {
    e.stopPropagation();
    select(id);
  };
  const onPointerOver = (e: ThreeEvent<PointerEvent>) => {
    e.stopPropagation();
    hover(id);
  };
  const onPointerOut = () => {
    if (usePalaceStore.getState().hoveredId === id) hover(null);
  };

  const emissive = hovered ? HOVER_EMISSIVE : selected ? SELECT_EMISSIVE : "#000000";
  const emissiveIntensity = hovered ? 0.3 : selected ? 0.45 : 0;
  const plaqueY = -(PAINTING_HEIGHT / 2 + FRAME_BORDER + PLAQUE_HEIGHT / 2 + 0.03);

  return (
    <group position={placement.position} rotation-y={placement.rotationY} onClick={onClick} onPointerOver={onPointerOver} onPointerOut={onPointerOut}>
      <mesh geometry={geometries.frame}>
        <meshStandardMaterial color={PLASTER_SHADOW} roughness={0.85} emissive={emissive} emissiveIntensity={emissiveIntensity} />
      </mesh>
      <mesh geometry={geometries.canvas} position-z={FRAME_DEPTH / 2 + 0.002}>
        <meshStandardMaterial color={FORGOTTEN_CANVAS} roughness={1} />
      </mesh>
      <Plaque text="forgotten" position={[0, plaqueY, FRAME_DEPTH / 2 - 0.02]} font={font} />
    </group>
  );
}
