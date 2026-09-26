"use client";
/**
 * A soft radial glow sprite that blooms around a recalled object and fades over 900 ms. One shared
 * radial-gradient texture; each orb is a sprite that stays invisible until its pulse timestamp moves.
 * Additive so it reads as light on the white plaster without darkening anything.
 */
import { useFrame } from "@react-three/fiber";
import { useRef } from "react";
import * as THREE from "three";
import { PULSE_EMISSIVE } from "./palette";
import { orbOpacity, orbProgress, orbScale } from "./pulse";

let texture: THREE.CanvasTexture | null = null;

/** Radial falloff drawn once on a small canvas; null without a document (SSR, tests). */
function orbTexture(): THREE.CanvasTexture | null {
  if (texture) return texture;
  if (typeof document === "undefined") return null;
  const size = 128;
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;
  const gradient = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  gradient.addColorStop(0, "rgba(255,255,255,1)");
  gradient.addColorStop(0.25, "rgba(255,255,255,0.55)");
  gradient.addColorStop(0.6, "rgba(255,255,255,0.12)");
  gradient.addColorStop(1, "rgba(255,255,255,0)");
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, size, size);
  texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

export interface RecallOrbProps {
  /** Store timestamp of the last recall pulse (ms), 0 for none. */
  pulseAt: number;
  /** Local position of the orb's centre. */
  position?: [number, number, number];
}

export function RecallOrb({ pulseAt, position = [0, 0, 0] }: RecallOrbProps) {
  const spriteRef = useRef<THREE.Sprite>(null);
  const map = orbTexture();

  useFrame(() => {
    const sprite = spriteRef.current;
    if (!sprite) return;
    const progress = orbProgress(pulseAt, Date.now());
    if (progress === null) {
      if (sprite.visible) sprite.visible = false;
      return;
    }
    sprite.visible = true;
    const s = orbScale(progress);
    sprite.scale.set(s, s, 1);
    (sprite.material as THREE.SpriteMaterial).opacity = orbOpacity(progress);
  });

  if (!map) return null;
  return (
    <sprite ref={spriteRef} position={position} visible={false} renderOrder={10}>
      <spriteMaterial map={map} color={PULSE_EMISSIVE} transparent opacity={0} depthWrite={false} blending={THREE.AdditiveBlending} toneMapped={false} />
    </sprite>
  );
}
