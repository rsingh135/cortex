"use client";
/**
 * Feeds the camera's floor position and heading to the HUD minimap about ten times a second.
 * Lives in the page layer because the scene may not import from the HUD.
 */
import { useFrame, useThree } from "@react-three/fiber";
import { useRef } from "react";
import { Vector3 } from "three";
import { setPlayerPosition } from "@/hud";

const INTERVAL_S = 0.1;

export function PlayerTracker() {
  const camera = useThree((s) => s.camera);
  const elapsed = useRef(INTERVAL_S);
  const forward = useRef(new Vector3());

  useFrame((_, delta) => {
    elapsed.current += delta;
    if (elapsed.current < INTERVAL_S) return;
    elapsed.current = 0;
    const dir = camera.getWorldDirection(forward.current);
    // Minimap heading convention: forward on the floor is [-sin(yaw), -cos(yaw)].
    const yaw = Math.atan2(-dir.x, -dir.z);
    setPlayerPosition(camera.position.x, camera.position.z, yaw);
  });

  return null;
}
