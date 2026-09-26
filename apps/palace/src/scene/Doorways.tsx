"use client";
/**
 * Clickable doorway volumes: a faint warm glow at rest (so every opening reads as a door from across
 * the atrium), brighter on hover, eased rather than snapped. A click flies the camera through: into
 * the room from the atrium, back out to the atrium from inside. Ignored while the pointer is locked,
 * where `E` and click are handled by the first-person controls instead.
 */
import { useFrame, useThree, type ThreeEvent } from "@react-three/fiber";
import { useEffect, useMemo, useRef, useState } from "react";
import { MathUtils, type MeshBasicMaterial } from "three";
import { DOOR_HEIGHT, DOOR_WIDTH, roomAt, roomRotationY } from "@/lib/layout";
import { useLayout } from "@/lib/store";
import type { Vec3 } from "@/lib/types";
import { flyThroughDoorway } from "./flyThroughDoorway";
import { doorways, type Doorway } from "./geometry";
import { PALETTE } from "./materials";

const REST_OPACITY = 0.12;
const HOVER_OPACITY = 0.3;
/** Exponential smoothing rate for the glow (settles in roughly 250 ms). */
const GLOW_LAMBDA = 12;

export function Doorways() {
  const layout = useLayout();
  const ways = useMemo(() => doorways(layout), [layout]);
  return (
    <group>
      {ways.map((d) => (
        <DoorwayVolume key={d.room} doorway={d} />
      ))}
    </group>
  );
}

interface DoorwayVolumeProps {
  doorway: Doorway;
}

function DoorwayVolume({ doorway }: DoorwayVolumeProps) {
  const layout = useLayout();
  const camera = useThree((s) => s.camera);
  const [hovered, setHovered] = useState(false);
  const materialRef = useRef<MeshBasicMaterial>(null);

  useEffect(() => {
    if (!hovered || typeof document === "undefined") return;
    const previous = document.body.style.cursor;
    document.body.style.cursor = "pointer";
    return () => {
      document.body.style.cursor = previous;
    };
  }, [hovered]);

  useFrame((_, delta) => {
    const material = materialRef.current;
    if (!material) return;
    const target = hovered ? HOVER_OPACITY : REST_OPACITY;
    if (Math.abs(material.opacity - target) < 1e-3) {
      material.opacity = target;
      return;
    }
    material.opacity = MathUtils.damp(material.opacity, target, GLOW_LAMBDA, delta);
  });

  const center: Vec3 = [(doorway.outer[0] + doorway.inner[0]) / 2, DOOR_HEIGHT / 2, (doorway.outer[2] + doorway.inner[2]) / 2];

  const onClick = (e: ThreeEvent<MouseEvent>) => {
    if (typeof document !== "undefined" && document.pointerLockElement) return;
    e.stopPropagation();
    const from: Vec3 = [camera.position.x, camera.position.y, camera.position.z];
    flyThroughDoorway(doorway, roomAt(layout, from) === doorway.room);
  };

  return (
    <mesh
      position={center}
      rotation-y={roomRotationY(doorway.room)}
      onClick={onClick}
      onPointerOver={(e) => {
        e.stopPropagation();
        setHovered(true);
      }}
      onPointerOut={() => setHovered(false)}
    >
      <boxGeometry args={[DOOR_WIDTH, DOOR_HEIGHT, Math.max(doorway.length, 0.5)]} />
      <meshBasicMaterial ref={materialRef} color={PALETTE.doorGlow} transparent opacity={REST_OPACITY} depthWrite={false} />
    </mesh>
  );
}
