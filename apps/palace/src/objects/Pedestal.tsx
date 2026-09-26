"use client";
/**
 * Plaster pedestals under beliefs. `Pedestals` draws every pedestal in a room set with three
 * instanced meshes (column, cap, gold trim); `Pedestal` is the single-mesh version for one-offs.
 */
import { Instance, Instances } from "@react-three/drei";
import { useEffect, useMemo } from "react";
import * as THREE from "three";
import type { Vec3 } from "@/lib/types";
import { GOLD, PEDESTAL_CAP, PEDESTAL_HEIGHT, PEDESTAL_RADIUS, PLASTER } from "./palette";

export interface PedestalSpec {
  id: string;
  position: Vec3;
  rotationY: number;
  /** Pinned or voice/manual belief: gold trim ring under the cap. */
  gold: boolean;
}

const CAP_THICKNESS = 0.05;
const TRIM_Y = PEDESTAL_HEIGHT - CAP_THICKNESS - 0.03;
const MIN_CAPACITY = 1024;

function capacityFor(count: number): number {
  let cap = MIN_CAPACITY;
  while (cap < count) cap *= 2;
  return cap;
}

interface PedestalGeometries {
  column: THREE.CylinderGeometry;
  cap: THREE.BoxGeometry;
  trim: THREE.TorusGeometry;
}

function usePedestalGeometries(): PedestalGeometries {
  const geometries = useMemo<PedestalGeometries>(() => {
    const trim = new THREE.TorusGeometry(PEDESTAL_RADIUS * 0.93 + 0.02, 0.015, 12, 40);
    trim.rotateX(Math.PI / 2);
    return {
      column: new THREE.CylinderGeometry(PEDESTAL_RADIUS * 0.9, PEDESTAL_RADIUS, PEDESTAL_HEIGHT - CAP_THICKNESS, 24),
      cap: new THREE.BoxGeometry(PEDESTAL_CAP, CAP_THICKNESS, PEDESTAL_CAP),
      trim,
    };
  }, []);
  useEffect(
    () => () => {
      geometries.column.dispose();
      geometries.cap.dispose();
      geometries.trim.dispose();
    },
    [geometries],
  );
  return geometries;
}

export interface PedestalsProps {
  pedestals: readonly PedestalSpec[];
}

export function Pedestals({ pedestals }: PedestalsProps) {
  const geometries = usePedestalGeometries();
  const capacity = capacityFor(pedestals.length);
  const gold = useMemo(() => pedestals.filter((p) => p.gold), [pedestals]);
  const goldCapacity = capacityFor(gold.length);

  return (
    <group name="pedestals">
      <Instances key={`column-${capacity}`} geometry={geometries.column} limit={capacity} castShadow receiveShadow>
        <meshStandardMaterial color={PLASTER} roughness={0.92} metalness={0} />
        {pedestals.map((p) => (
          <Instance key={p.id} position={[p.position[0], p.position[1] + (PEDESTAL_HEIGHT - CAP_THICKNESS) / 2, p.position[2]]} rotation-y={p.rotationY} />
        ))}
      </Instances>
      <Instances key={`cap-${capacity}`} geometry={geometries.cap} limit={capacity} castShadow receiveShadow>
        <meshStandardMaterial color={PLASTER} roughness={0.85} metalness={0} />
        {pedestals.map((p) => (
          <Instance key={p.id} position={[p.position[0], p.position[1] + PEDESTAL_HEIGHT - CAP_THICKNESS / 2, p.position[2]]} rotation-y={p.rotationY} />
        ))}
      </Instances>
      {gold.length > 0 && (
        <Instances key={`trim-${goldCapacity}`} geometry={geometries.trim} limit={goldCapacity}>
          <meshStandardMaterial color={GOLD} roughness={0.35} metalness={0.8} />
          {gold.map((p) => (
            <Instance key={p.id} position={[p.position[0], p.position[1] + TRIM_Y, p.position[2]]} />
          ))}
        </Instances>
      )}
    </group>
  );
}

export interface PedestalProps {
  position: Vec3;
  rotationY?: number;
  gold?: boolean;
}

/** One pedestal as plain meshes; use `Pedestals` for a room full of them. */
export function Pedestal({ position, rotationY = 0, gold = false }: PedestalProps) {
  const geometries = usePedestalGeometries();
  return (
    <group position={position} rotation-y={rotationY}>
      <mesh geometry={geometries.column} position-y={(PEDESTAL_HEIGHT - CAP_THICKNESS) / 2} castShadow receiveShadow>
        <meshStandardMaterial color={PLASTER} roughness={0.92} metalness={0} />
      </mesh>
      <mesh geometry={geometries.cap} position-y={PEDESTAL_HEIGHT - CAP_THICKNESS / 2} castShadow receiveShadow>
        <meshStandardMaterial color={PLASTER} roughness={0.85} metalness={0} />
      </mesh>
      {gold && (
        <mesh geometry={geometries.trim} position-y={TRIM_Y}>
          <meshStandardMaterial color={GOLD} roughness={0.35} metalness={0.8} />
        </mesh>
      )}
    </group>
  );
}
