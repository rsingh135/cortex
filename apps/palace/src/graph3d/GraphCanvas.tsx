"use client";
/**
 * Dark canvas for the belief graph: deep charcoal, gentle fog, a faint star field for depth.
 * Same pointer handling as the room palace so walk mode's crosshair picks nodes.
 */
import { Canvas } from "@react-three/fiber";
import { Sparkles } from "@react-three/drei";
import type { ReactNode } from "react";
import { ACESFilmicToneMapping, SRGBColorSpace } from "three";
import { eventManager } from "@/scene/PalaceCanvas";
import { graphSpawn } from "@/lib/graphLayout";

export const GRAPH_BACKGROUND = "#0e0f12";

export interface GraphCanvasProps {
  children?: ReactNode;
  onPointerMissed?: (event: MouseEvent) => void;
}

export function GraphCanvas({ children, onPointerMissed }: GraphCanvasProps) {
  const spawn = graphSpawn();
  return (
    <Canvas
      dpr={[1, 2]}
      camera={{ fov: 70, near: 0.05, far: 300, position: spawn.position }}
      gl={{ antialias: true, toneMapping: ACESFilmicToneMapping, toneMappingExposure: 1.0, outputColorSpace: SRGBColorSpace }}
      events={eventManager}
      onPointerMissed={onPointerMissed}
      style={{ width: "100%", height: "100%", display: "block", touchAction: "none" }}
    >
      <color attach="background" args={[GRAPH_BACKGROUND]} />
      <fog attach="fog" args={[GRAPH_BACKGROUND, 24, 70]} />
      <ambientLight intensity={0.35} />
      <pointLight position={[0, 12, 0]} intensity={40} color="#cfd6ff" />
      <Sparkles count={240} scale={[70, 24, 70]} size={1.2} speed={0.15} opacity={0.35} color="#9aa4c2" />
      {children}
    </Canvas>
  );
}
