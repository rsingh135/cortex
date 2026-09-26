"use client";
/**
 * Orbit mode: drei OrbitControls around the palace centre, mounted only while `controlsMode` is
 * "orbit". Entering orbit flies the camera to a bird's-eye pose first; the controls stay disabled
 * until that flight lands so the two never fight over the camera.
 */
import { OrbitControls } from "@react-three/drei";
import { useEffect, useRef } from "react";
import { layoutExtent } from "@/lib/layout";
import { useControlsMode, useLayout } from "@/lib/store";
import { flyToPose } from "./flyBus";
import { overviewPose } from "./geometry";
import { useFlying } from "./useFlying";

export function OrbitFallback() {
  const layout = useLayout();
  const enabled = useControlsMode() === "orbit";
  const flying = useFlying();
  const wasEnabled = useRef(false);

  useEffect(() => {
    if (enabled && !wasEnabled.current) {
      const pose = overviewPose(layout);
      flyToPose(pose.position, pose.target);
    }
    wasEnabled.current = enabled;
  }, [enabled, layout]);

  if (!enabled) return null;
  const extent = layoutExtent(layout);
  return (
    <OrbitControls
      enabled={!flying}
      target={[0, 0, 0]}
      enableDamping
      dampingFactor={0.08}
      minDistance={2}
      maxDistance={extent * 3}
      maxPolarAngle={Math.PI / 2 - 0.03}
      zoomSpeed={0.8}
    />
  );
}
