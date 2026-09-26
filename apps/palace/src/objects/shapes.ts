"use client";
/**
 * One shared geometry per belief kind (fact cube, event disc, person capsule, preference
 * octahedron, routine ring, style cone, summary slab), each translated so it stands on y = 0.
 */
import type { Kind } from "@cortex/schema";
import * as THREE from "three";
import { BELIEF_SIZE, KIND_COLORS } from "./palette";
import { clamp01 } from "./pulse";

const geometries = new Map<Kind, THREE.BufferGeometry>();

function build(kind: Kind): THREE.BufferGeometry {
  const s = BELIEF_SIZE;
  switch (kind) {
    case "fact":
      return new THREE.BoxGeometry(s * 1.7, s * 1.7, s * 1.7);
    case "event":
      return new THREE.CylinderGeometry(s, s, s * 0.3, 32);
    case "person":
      return new THREE.CapsuleGeometry(s * 0.5, s * 1.0, 6, 16);
    case "preference":
      return new THREE.OctahedronGeometry(s * 1.1);
    case "routine":
      return new THREE.TorusGeometry(s * 0.75, s * 0.22, 16, 40);
    case "style":
      return new THREE.ConeGeometry(s * 0.8, s * 2, 24);
    case "summary":
      return new THREE.BoxGeometry(s * 2.2, s * 0.35, s * 1.4);
  }
}

/** Shared, never disposed: seven geometries for the whole scene. */
export function beliefGeometry(kind: Kind): THREE.BufferGeometry {
  const cached = geometries.get(kind);
  if (cached) return cached;
  const g = build(kind);
  g.computeBoundingBox();
  const minY = g.boundingBox?.min.y ?? 0;
  g.translate(0, -minY, 0);
  geometries.set(kind, g);
  return g;
}

/** Kind hue with saturation scaled by confidence (0.35 -> 1). */
export function beliefColor(kind: Kind, confidence: number): THREE.Color {
  const color = new THREE.Color(KIND_COLORS[kind]);
  const hsl = { h: 0, s: 0, l: 0 };
  color.getHSL(hsl);
  color.setHSL(hsl.h, hsl.s * (0.35 + 0.65 * clamp01(confidence)), hsl.l);
  return color;
}
