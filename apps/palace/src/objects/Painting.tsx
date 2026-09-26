"use client";
/**
 * A capture hanging on a wall: dark-wood frame around a plane that shows the ceiling-level
 * screenshot through the gaussian blur shader. Blur radius follows (1 - clarity); a recall pulse
 * snaps it sharp, holds, then eases the blur back. Texture comes from the process-wide cache and
 * tolerates a null or still-loading URL.
 */
import type { ThreeEvent } from "@react-three/fiber";
import { useFrame } from "@react-three/fiber";
import { useMemo, useRef } from "react";
import * as THREE from "three";
import { useCapture, useIsHovered, useIsSelected, usePalaceActions, usePalaceStore, usePulse } from "@/lib/store";
import type { Placement } from "@/lib/types";
import { BLUR_FRAGMENT_SHADER, BLUR_VERTEX_SHADER, createBlurUniforms, type BlurMaterial } from "./blurMaterial";
import { DARK_WOOD, FRAME_BORDER, FRAME_DEPTH, HOVER_EMISSIVE, MAX_BLUR_RADIUS, PAINTING_HEIGHT, PAINTING_WIDTH, SELECT_EMISSIVE, SHARPEN_FADE_MS, SHARPEN_HOLD_MS } from "./palette";
import { clamp01, sharpenAmount } from "./pulse";
import { useCachedTexture } from "./textureCache";

export interface PaintingProps {
  id: string;
  placement: Placement;
}

interface FrameGeometries {
  canvas: THREE.PlaneGeometry;
  frame: THREE.BoxGeometry;
}

let shared: FrameGeometries | null = null;
/** Shared by every painting and empty frame; never disposed. */
export function frameGeometries(): FrameGeometries {
  shared ??= {
    canvas: new THREE.PlaneGeometry(PAINTING_WIDTH, PAINTING_HEIGHT),
    frame: new THREE.BoxGeometry(PAINTING_WIDTH + 2 * FRAME_BORDER, PAINTING_HEIGHT + 2 * FRAME_BORDER, FRAME_DEPTH),
  };
  return shared;
}

const BLUR_DAMPING = 10;

export function Painting({ id, placement }: PaintingProps) {
  const capture = useCapture(id);
  const pulseAt = usePulse(id);
  const selected = useIsSelected(id);
  const hovered = useIsHovered(id);
  const { select, hover } = usePalaceActions();
  const texture = useCachedTexture(capture?.textureUrl ?? null);
  const materialRef = useRef<BlurMaterial>(null);
  const uniforms = useMemo(() => createBlurUniforms(), []);
  const geometries = frameGeometries();

  const targetRadius = MAX_BLUR_RADIUS * (1 - clamp01(capture?.clarity ?? 0));

  useFrame((_, delta) => {
    const material = materialRef.current;
    if (!material) return;
    const sharpen = sharpenAmount(pulseAt, Date.now(), SHARPEN_HOLD_MS, SHARPEN_FADE_MS);
    const target = targetRadius * (1 - sharpen);
    const radius = material.uniforms.uRadius;
    if (Math.abs(radius.value - target) < 1e-5) return;
    // Snap sharp instantly on recall; ease everywhere else.
    radius.value = sharpen >= 1 ? target : THREE.MathUtils.damp(radius.value, target, BLUR_DAMPING, delta);
  });

  if (!capture) return null;

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
      <mesh geometry={geometries.frame} castShadow>
        <meshStandardMaterial color={DARK_WOOD} roughness={0.7} emissive={emissive} emissiveIntensity={emissiveIntensity} />
      </mesh>
      <mesh geometry={geometries.canvas} position-z={FRAME_DEPTH / 2 + 0.002}>
        <shaderMaterial
          ref={materialRef}
          uniforms={uniforms}
          vertexShader={BLUR_VERTEX_SHADER}
          fragmentShader={BLUR_FRAGMENT_SHADER}
          toneMapped={false}
          uniforms-uMap-value={texture}
          uniforms-uHasMap-value={texture ? 1 : 0}
        />
      </mesh>
    </group>
  );
}
