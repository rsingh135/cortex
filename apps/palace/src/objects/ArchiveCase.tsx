"use client";
/**
 * A superseded belief in the Archive alcove: its kind shape, desaturated, under a glass case on
 * a plaster plinth with a "superseded" plaque.
 */
import { Edges } from "@react-three/drei";
import type { ThreeEvent } from "@react-three/fiber";
import { useMemo } from "react";
import * as THREE from "three";
import { useBelief, useIsHovered, useIsSelected, usePalaceActions, usePalaceStore } from "@/lib/store";
import type { Placement } from "@/lib/types";
import { CASE_BASE_HEIGHT, CASE_BASE_WIDTH, CASE_SIZE, GLASS, GLASS_EDGE, HOVER_EMISSIVE, PLASTER, SELECT_EMISSIVE } from "./palette";
import { Plaque } from "./Plaque";
import { beliefColor, beliefGeometry } from "./shapes";

export interface ArchiveCaseProps {
  id: string;
  placement: Placement;
  /** Optional font URL for the plaque text. */
  font?: string;
}

interface CaseGeometries {
  base: THREE.BoxGeometry;
  glass: THREE.BoxGeometry;
}

let shared: CaseGeometries | null = null;
function caseGeometries(): CaseGeometries {
  shared ??= { base: new THREE.BoxGeometry(CASE_BASE_WIDTH, CASE_BASE_HEIGHT, CASE_BASE_WIDTH), glass: new THREE.BoxGeometry(CASE_SIZE, CASE_SIZE, CASE_SIZE) };
  return shared;
}

const INNER_SCALE = 0.7;

export function ArchiveCase({ id, placement, font }: ArchiveCaseProps) {
  const belief = useBelief(id);
  const selected = useIsSelected(id);
  const hovered = useIsHovered(id);
  const { select, hover } = usePalaceActions();
  const geometries = caseGeometries();
  const kind = belief?.kind ?? "fact";
  const color = useMemo(() => beliefColor(kind, 0.25), [kind]);

  if (!belief) return null;

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

  return (
    <group position={placement.position} rotation-y={placement.rotationY} onClick={onClick} onPointerOver={onPointerOver} onPointerOut={onPointerOut}>
      <mesh geometry={geometries.base} position-y={CASE_BASE_HEIGHT / 2} castShadow receiveShadow>
        <meshStandardMaterial color={PLASTER} roughness={0.9} emissive={emissive} emissiveIntensity={emissiveIntensity} />
      </mesh>
      <mesh geometry={beliefGeometry(kind)} position-y={CASE_BASE_HEIGHT + 0.01} scale={INNER_SCALE}>
        <meshStandardMaterial color={color} transparent opacity={0.6} roughness={0.6} />
      </mesh>
      <mesh geometry={geometries.glass} position-y={CASE_BASE_HEIGHT + CASE_SIZE / 2}>
        <meshStandardMaterial color={GLASS} transparent opacity={0.18} roughness={0.1} metalness={0} depthWrite={false} />
        <Edges color={GLASS_EDGE} />
      </mesh>
      <Plaque text="superseded" position={[0, CASE_BASE_HEIGHT * 0.55, CASE_BASE_WIDTH / 2 + 0.006]} font={font} />
    </group>
  );
}
