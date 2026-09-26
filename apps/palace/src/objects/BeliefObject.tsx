"use client";
/**
 * One belief on its pedestal. Shape by kind, opacity and saturation by confidence, sinks when
 * confidence is low, hover/selection glow, and a 600 ms scale pulse with a warm rim when the
 * store stamps a recall. Gold trim lives on the pedestal (see `Pedestals`).
 */
import type { ThreeEvent } from "@react-three/fiber";
import { useFrame } from "@react-three/fiber";
import { useMemo, useRef } from "react";
import * as THREE from "three";
import { useBelief, useIsHovered, useIsSelected, usePalaceActions, usePalaceStore, usePulse } from "@/lib/store";
import type { Placement } from "@/lib/types";
import { beliefOpacity, beliefSink } from "./anchors";
import { GOLD, HOVER_EMISSIVE, PEDESTAL_HEIGHT, PULSE_EMISSIVE, SELECT_EMISSIVE } from "./palette";
import { pulseGlow, pulseProgress, pulseScale } from "./pulse";
import { beliefColor, beliefGeometry } from "./shapes";

export interface BeliefObjectProps {
  id: string;
  placement: Placement;
}

const HOVER_INTENSITY = 0.35;
const SELECT_INTENSITY = 0.5;
const PULSE_INTENSITY = 0.9;
const BLACK = new THREE.Color(0x000000);
const HOVER = new THREE.Color(HOVER_EMISSIVE);
const SELECT = new THREE.Color(SELECT_EMISSIVE);
const PULSE = new THREE.Color(PULSE_EMISSIVE);

let selectionRing: THREE.TorusGeometry | null = null;
function selectionRingGeometry(): THREE.TorusGeometry {
  if (!selectionRing) {
    selectionRing = new THREE.TorusGeometry(0.3, 0.012, 8, 48);
    selectionRing.rotateX(Math.PI / 2);
  }
  return selectionRing;
}

export function BeliefObject({ id, placement }: BeliefObjectProps) {
  const belief = useBelief(id);
  const pulseAt = usePulse(id);
  const selected = useIsSelected(id);
  const hovered = useIsHovered(id);
  const { select, hover } = usePalaceActions();
  const groupRef = useRef<THREE.Group>(null);
  const materialRef = useRef<THREE.MeshStandardMaterial>(null);
  const pulsing = useRef(false);

  const kind = belief?.kind ?? "fact";
  const confidence = belief?.confidence ?? 0;
  const color = useMemo(() => beliefColor(kind, confidence), [kind, confidence]);
  const geometry = beliefGeometry(kind);
  const opacity = beliefOpacity(confidence);
  const sink = beliefSink(confidence);
  const baseEmissive = hovered ? HOVER : selected ? SELECT : BLACK;
  const baseIntensity = hovered ? HOVER_INTENSITY : selected ? SELECT_INTENSITY : 0;

  useFrame(() => {
    const group = groupRef.current;
    const material = materialRef.current;
    if (!group || !material) return;
    const progress = pulseProgress(pulseAt, Date.now());
    if (progress === null) {
      if (pulsing.current) {
        pulsing.current = false;
        group.scale.setScalar(1);
        material.emissive.copy(baseEmissive);
        material.emissiveIntensity = baseIntensity;
      }
      return;
    }
    pulsing.current = true;
    group.scale.setScalar(pulseScale(progress));
    material.emissive.copy(PULSE);
    material.emissiveIntensity = PULSE_INTENSITY * pulseGlow(progress);
  });

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

  const [x, y, z] = placement.position;
  return (
    <group position={[x, y + PEDESTAL_HEIGHT - sink, z]} rotation-y={placement.rotationY}>
      <group ref={groupRef}>
        <mesh geometry={geometry} onClick={onClick} onPointerOver={onPointerOver} onPointerOut={onPointerOut} castShadow>
          <meshStandardMaterial
            ref={materialRef}
            color={color}
            transparent
            opacity={opacity}
            roughness={0.45}
            metalness={0.05}
            emissive={baseEmissive}
            emissiveIntensity={baseIntensity}
          />
        </mesh>
      </group>
      {selected && (
        <mesh geometry={selectionRingGeometry()} position-y={0.005}>
          <meshBasicMaterial color={GOLD} toneMapped={false} />
        </mesh>
      )}
    </group>
  );
}
