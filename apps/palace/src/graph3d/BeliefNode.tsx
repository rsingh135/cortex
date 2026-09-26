"use client";
/**
 * One belief as a glowing node. Size and brightness follow confidence; a recall pulses it; hover
 * eases it larger and shows its text; a node whose belief was forgotten flickers out.
 */
import { Billboard, Text } from "@react-three/drei";
import { useFrame, type ThreeEvent } from "@react-three/fiber";
import { useMemo, useRef } from "react";
import * as THREE from "three";
import { truncate } from "@/lib/format";
import type { GraphNode } from "@/lib/graphLayout";
import { useBelief, useIsHovered, useIsSelected, usePalaceActions, usePalaceStore, usePulse } from "@/lib/store";
import { PULSE_MS, pulseProgress, pulseScale } from "@/objects/pulse";

const BASE_RADIUS = 0.22;
const GLOW_SCALE = 3.2;
const LEAVE_MS = 700;

let glowTexture: THREE.Texture | null = null;
function glow(): THREE.Texture {
  if (glowTexture) return glowTexture;
  const size = 128;
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = size;
  const ctx = canvas.getContext("2d")!;
  const g = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  g.addColorStop(0, "rgba(255,255,255,0.9)");
  g.addColorStop(0.35, "rgba(255,255,255,0.35)");
  g.addColorStop(1, "rgba(255,255,255,0)");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, size, size);
  glowTexture = new THREE.CanvasTexture(canvas);
  glowTexture.colorSpace = THREE.SRGBColorSpace;
  return glowTexture;
}

const sphere = new THREE.SphereGeometry(1, 24, 24);

export interface BeliefNodeProps {
  node: GraphNode;
  font?: string;
  /** Set when the belief left the graph; the node flickers out and the parent unmounts it after LEAVE_MS. */
  leavingSince?: number;
}

export function BeliefNode({ node, font, leavingSince }: BeliefNodeProps) {
  const belief = useBelief(node.id);
  const pulseAt = usePulse(node.id);
  const hovered = useIsHovered(node.id);
  const selected = useIsSelected(node.id);
  const { select, hover } = usePalaceActions();
  const group = useRef<THREE.Group>(null);
  const core = useRef<THREE.Mesh>(null);
  const halo = useRef<THREE.Sprite>(null);
  const color = useMemo(() => new THREE.Color(node.color), [node.color]);
  const confidence = belief?.confidence ?? 0.3;
  const gold = belief?.pinned || belief?.source === "voice" || belief?.source === "manual";

  useFrame((_, delta) => {
    const g = group.current;
    const c = core.current;
    const h = halo.current;
    if (!g || !c || !h) return;
    const now = Date.now();
    let target = BASE_RADIUS * (0.7 + confidence * 0.9) * (hovered || selected ? 1.25 : 1);
    const p = pulseProgress(pulseAt, now);
    if (p !== null) target *= pulseScale(p);
    if (leavingSince) {
      const t = Math.min(1, (now - leavingSince) / LEAVE_MS);
      const flicker = t < 0.7 ? (Math.sin(t * 60) > 0 ? 1 : 0.35) : 0;
      target *= (1 - t) * flicker;
    }
    const s = THREE.MathUtils.damp(g.scale.x, target, 12, delta);
    g.scale.setScalar(Math.max(s, 0.0001));
    const mat = c.material as THREE.MeshStandardMaterial;
    const glowAmt = 0.4 + confidence * 1.6 + (hovered || selected ? 0.8 : 0) + (p !== null && now - pulseAt < PULSE_MS ? 1.5 : 0);
    mat.emissiveIntensity = THREE.MathUtils.damp(mat.emissiveIntensity, glowAmt, 10, delta);
    const spriteMat = h.material as THREE.SpriteMaterial;
    spriteMat.opacity = THREE.MathUtils.damp(spriteMat.opacity, 0.25 + confidence * 0.45 + (hovered || selected ? 0.2 : 0), 10, delta);
  });

  if (!belief && !leavingSince) return null;

  const onClick = (e: ThreeEvent<MouseEvent>) => {
    e.stopPropagation();
    select(node.id);
  };
  const onOver = (e: ThreeEvent<PointerEvent>) => {
    e.stopPropagation();
    hover(node.id);
  };
  const onOut = () => {
    if (usePalaceStore.getState().hoveredId === node.id) hover(null);
  };
  const label = belief ? truncate(belief.text, 56) : "";

  return (
    <group position={node.position}>
      <group ref={group} scale={0.0001} onClick={onClick} onPointerOver={onOver} onPointerOut={onOut}>
        <mesh ref={core} geometry={sphere}>
          <meshStandardMaterial color={gold ? "#ffd27a" : color} emissive={gold ? "#ffb52e" : color} emissiveIntensity={1} roughness={0.35} metalness={0.1} />
        </mesh>
        <sprite ref={halo} scale={[GLOW_SCALE, GLOW_SCALE, 1]}>
          <spriteMaterial map={glow()} color={gold ? "#ffcc66" : color} transparent opacity={0.3} depthWrite={false} blending={THREE.AdditiveBlending} />
        </sprite>
      </group>
      {(hovered || selected) && belief && (
        <Billboard position={[0, 0.55, 0]}>
          <Text font={font} fontSize={0.22} maxWidth={5} anchorX="center" anchorY="bottom" color="#f4f5f9" outlineWidth={0.012} outlineColor="#0e0f12">
            {label}
          </Text>
        </Billboard>
      )}
    </group>
  );
}
