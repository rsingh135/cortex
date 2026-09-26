"use client";
/**
 * Edges between belief nodes as thin lines: learner edges (derived_from, uses, supersedes) a touch
 * brighter than shared-evidence links. Opacity follows the weaker endpoint's confidence so edges
 * fade with their beliefs during a fast-forward.
 */
import { useFrame } from "@react-three/fiber";
import { useMemo, useRef } from "react";
import * as THREE from "three";
import type { GraphLayout } from "@/lib/graphLayout";
import { usePalaceStore } from "@/lib/store";

const STRONG = new THREE.Color("#8d95b3");
const WEAK = new THREE.Color("#4b5168");

export function GraphLinks({ layout }: { layout: GraphLayout }) {
  const geometry = useMemo(() => {
    const positions: number[] = [];
    const colors: number[] = [];
    for (const l of layout.links) {
      const a = layout.nodes.get(l.from);
      const b = layout.nodes.get(l.to);
      if (!a || !b) continue;
      positions.push(...a.position, ...b.position);
      const c = l.kind === "shared_evidence" ? WEAK : STRONG;
      colors.push(c.r, c.g, c.b, c.r, c.g, c.b);
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
    geo.setAttribute("color", new THREE.Float32BufferAttribute(colors, 3));
    return geo;
  }, [layout]);
  const material = useRef<THREE.LineBasicMaterial>(null);

  useFrame((_, delta) => {
    const m = material.current;
    if (!m) return;
    const beliefs = usePalaceStore.getState().snapshot.beliefs;
    let sum = 0;
    let n = 0;
    for (const l of layout.links) {
      const a = beliefs.find((b) => b.id === l.from)?.confidence ?? 0;
      const b = beliefs.find((b) => b.id === l.to)?.confidence ?? 0;
      sum += Math.min(a, b);
      n += 1;
    }
    const target = n ? 0.12 + (sum / n) * 0.5 : 0;
    m.opacity = THREE.MathUtils.damp(m.opacity, target, 6, delta);
  });

  if (layout.links.length === 0) return null;
  return (
    <lineSegments geometry={geometry}>
      <lineBasicMaterial ref={material} vertexColors transparent opacity={0.35} depthWrite={false} />
    </lineSegments>
  );
}
