"use client";
/**
 * Soft daylight: a generous hemisphere fill and ambient (so plaster facing away from the sun still
 * reads white, not grey) plus one warm sun casting shadows over the whole palace footprint.
 */
import { useLayoutEffect, useRef } from "react";
import type { DirectionalLight } from "three";
import { layoutExtent } from "@/lib/layout";
import { useLayout } from "@/lib/store";
import { PALETTE } from "./materials";

export function Daylight() {
  const layout = useLayout();
  const extent = layoutExtent(layout);
  const sun = useRef<DirectionalLight>(null);

  useLayoutEffect(() => {
    const light = sun.current;
    if (!light) return;
    const cam = light.shadow.camera;
    cam.left = -extent;
    cam.right = extent;
    cam.top = extent;
    cam.bottom = -extent;
    cam.near = 1;
    cam.far = extent * 4;
    cam.updateProjectionMatrix();
    light.target.position.set(0, 0, 0);
    light.target.updateMatrixWorld();
  }, [extent]);

  return (
    <>
      <hemisphereLight color={PALETTE.fillSky} groundColor={PALETTE.fillGround} intensity={2.2} />
      <ambientLight color="#ffffff" intensity={0.6} />
      <directionalLight
        ref={sun}
        color="#fff5e6"
        intensity={1.8}
        position={[extent * 0.45, extent * 1.1, extent * 0.3]}
        castShadow
        shadow-mapSize={[2048, 2048]}
        shadow-bias={-0.0004}
        shadow-normalBias={0.03}
        shadow-radius={4}
      />
    </>
  );
}
