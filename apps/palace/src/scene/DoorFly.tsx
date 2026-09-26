"use client";
/**
 * Camera flight driver. Listens on the fly bus and tweens the default camera (position lerp,
 * orientation slerp, ease-in-out cubic) over the requested duration. Lives inside the Canvas.
 */
import { useFrame, useThree } from "@react-three/fiber";
import { useEffect, useRef } from "react";
import { Matrix4, Quaternion, Vector3 } from "three";
import { roomLayoutFor } from "@/lib/layout";
import { usePalaceStore } from "@/lib/store";
import { markFlying, subscribeFlight, type FlightRequest } from "./flyBus";
import { roomEntryPose, type CameraPose } from "./geometry";

interface ActiveFlight {
  fromPosition: Vector3;
  fromQuaternion: Quaternion;
  toPosition: Vector3;
  toQuaternion: Quaternion;
  durationMs: number;
  elapsedMs: number;
}

const UP = new Vector3(0, 1, 0);

function resolvePose(request: FlightRequest): CameraPose {
  if (request.kind === "pose") return { position: request.position, target: request.target };
  return roomEntryPose(roomLayoutFor(usePalaceStore.getState().layout, request.room));
}

function easeInOutCubic(t: number): number {
  return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
}

export function DoorFly() {
  const camera = useThree((s) => s.camera);
  const flight = useRef<ActiveFlight | null>(null);

  useEffect(() => {
    return subscribeFlight((request) => {
      const pose = resolvePose(request);
      const toPosition = new Vector3(...pose.position);
      const look = new Matrix4().lookAt(toPosition, new Vector3(...pose.target), UP);
      flight.current = {
        fromPosition: camera.position.clone(),
        fromQuaternion: camera.quaternion.clone(),
        toPosition,
        toQuaternion: new Quaternion().setFromRotationMatrix(look),
        durationMs: Math.max(1, request.durationMs),
        elapsedMs: 0,
      };
      markFlying(true);
    });
  }, [camera]);

  useEffect(() => () => markFlying(false), []);

  useFrame((_, delta) => {
    const f = flight.current;
    if (!f) return;
    f.elapsedMs += Math.min(delta, 0.1) * 1000;
    const t = Math.min(1, f.elapsedMs / f.durationMs);
    const e = easeInOutCubic(t);
    camera.position.lerpVectors(f.fromPosition, f.toPosition, e);
    camera.quaternion.slerpQuaternions(f.fromQuaternion, f.toQuaternion, e);
    if (t >= 1) {
      flight.current = null;
      markFlying(false);
    }
  });

  return null;
}
