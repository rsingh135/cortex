"use client";
/**
 * Where the player is, for the minimap's you-are-here dot. A tiny external store so the scene's
 * frame loop can write at 60 fps without re-rendering the whole HUD: only `usePlayerPosition`
 * subscribers update.
 */
import { useSyncExternalStore } from "react";

export interface PlayerPose {
  /** World x (meters). */
  x: number;
  /** World z (meters). */
  z: number;
  /** Camera `rotation.y` in radians; forward on the floor is `[-sin(yaw), -cos(yaw)]`. */
  yaw: number;
}

const ORIGIN: PlayerPose = { x: 0, z: 0, yaw: 0 };
let pose: PlayerPose = ORIGIN;
const listeners = new Set<() => void>();

/** Called by the scene each frame (or whenever the camera moves). Cheap; skips unchanged poses. */
export function setPlayerPosition(x: number, z: number, yaw: number = pose.yaw): void {
  if (x === pose.x && z === pose.z && yaw === pose.yaw) return;
  pose = { x, z, yaw };
  for (const listener of listeners) listener();
}

export function getPlayerPosition(): PlayerPose {
  return pose;
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function usePlayerPosition(): PlayerPose {
  return useSyncExternalStore(subscribe, getPlayerPosition, () => ORIGIN);
}
