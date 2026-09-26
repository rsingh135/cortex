"use client";
/**
 * Walk mode: mouse look under pointer lock, WASD / arrows, Shift to run, eye height 1.7, wall
 * collision from `collision.ts`. The lock itself is requested by `<Scene/>` on a click that hit no
 * object (so clicking a pedestal selects it without grabbing the mouse); this component tracks the
 * lock state into the store and, while locked, `E` or a click flies through the doorway you face.
 * Stands down while a flight is running or while orbit mode is active, and remembers the last walk
 * pose so switching back from orbit flies you home.
 */
import { useFrame, useThree } from "@react-three/fiber";
import { useEffect, useMemo, useRef } from "react";
import { Euler, Vector3 } from "three";
import { EYE_HEIGHT, roomAt } from "@/lib/layout";
import { useControlsMode, useLayout, usePalaceStore } from "@/lib/store";
import type { Vec3 } from "@/lib/types";
import { collisionSet, moveWithCollision } from "./collision";
import { flyToPose, isFlying } from "./flyBus";
import { flyThroughDoorway } from "./flyThroughDoorway";
import { doorwayInFront, doorways } from "./geometry";
import { DEFAULT_SPAWN } from "./PalaceCanvas";

export interface FirstPersonControlsProps {
  /** Where the walker starts. Default: 2.5 m east of the atrium centre, facing the Housing door. */
  spawn?: Vec3;
  /** Initial yaw in radians (0 looks down -z). Default faces +x (Housing). */
  spawnYaw?: number;
  walkSpeed?: number;
  runSpeed?: number;
  lookSensitivity?: number;
  /** Open space (the belief graph): no walls, no doorways. */
  noCollision?: boolean;
}

const MAX_PITCH = Math.PI / 2 - 0.08;
const FORWARD_KEYS = new Set(["KeyW", "ArrowUp"]);
const BACK_KEYS = new Set(["KeyS", "ArrowDown"]);
const LEFT_KEYS = new Set(["KeyA", "ArrowLeft"]);
const RIGHT_KEYS = new Set(["KeyD", "ArrowRight"]);
const RUN_KEYS = new Set(["ShiftLeft", "ShiftRight"]);

interface WalkPose {
  x: number;
  z: number;
  yaw: number;
  pitch: number;
}

function isTypingTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  const tag = target.tagName;
  return tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT" || target.isContentEditable;
}

export function FirstPersonControls({ spawn = DEFAULT_SPAWN, spawnYaw = -Math.PI / 2, walkSpeed = 3, runSpeed = 6, lookSensitivity = 0.0022, noCollision = false }: FirstPersonControlsProps) {
  const camera = useThree((s) => s.camera);
  const gl = useThree((s) => s.gl);
  const layout = useLayout();
  const enabled = useControlsMode() === "walk";

  const walls = useMemo(() => (noCollision ? [] : collisionSet(layout)), [layout, noCollision]);
  const ways = useMemo(() => (noCollision ? [] : doorways(layout)), [layout, noCollision]);

  const keys = useRef(new Set<string>());
  const pose = useRef<WalkPose>({ x: spawn[0], z: spawn[2], yaw: spawnYaw, pitch: 0 });
  const locked = useRef(false);
  const wasFlying = useRef(false);
  const wasEnabled = useRef<boolean | null>(null);
  const scratch = useRef({ euler: new Euler(0, 0, 0, "YXZ"), forward: new Vector3() });

  // Place the camera at the spawn pose once.
  useEffect(() => {
    const p = pose.current;
    camera.position.set(p.x, EYE_HEIGHT, p.z);
    camera.rotation.set(p.pitch, p.yaw, 0, "YXZ");
  }, [camera]);

  // Keyboard.
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (isTypingTarget(e.target)) return;
      keys.current.add(e.code);
      if (e.code === "KeyE" && enabled && !isFlying()) interactWithDoor();
    };
    const onKeyUp = (e: KeyboardEvent) => keys.current.delete(e.code);
    const onBlur = () => keys.current.clear();
    const interactWithDoor = () => {
      const p = pose.current;
      const position: Vec3 = [p.x, EYE_HEIGHT, p.z];
      const door = doorwayInFront(ways, position, [-Math.sin(p.yaw), -Math.cos(p.yaw)]);
      if (!door) return;
      flyThroughDoorway(door, roomAt(layout, position) === door.room);
    };
    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keyup", onKeyUp);
    window.addEventListener("blur", onBlur);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
      window.removeEventListener("blur", onBlur);
    };
  }, [enabled, layout, ways]);

  // Pointer lock state and mouse look. Re-syncs on every run: the browser keeps the lock across a
  // layout recompute, so the store must not be told "unlocked" just because this effect re-ran.
  useEffect(() => {
    const canvas = gl.domElement;
    const onClick = () => {
      if (!enabled || !locked.current || isFlying()) return;
      const p = pose.current;
      const position: Vec3 = [p.x, EYE_HEIGHT, p.z];
      const door = doorwayInFront(ways, position, [-Math.sin(p.yaw), -Math.cos(p.yaw)]);
      if (door) flyThroughDoorway(door, roomAt(layout, position) === door.room);
    };
    const onLockChange = () => {
      locked.current = document.pointerLockElement === canvas;
      usePalaceStore.getState().setPointerLocked(locked.current);
    };
    const onMouseMove = (e: MouseEvent) => {
      if (!locked.current || !enabled || isFlying()) return;
      const p = pose.current;
      p.yaw -= e.movementX * lookSensitivity;
      p.pitch = Math.max(-MAX_PITCH, Math.min(MAX_PITCH, p.pitch - e.movementY * lookSensitivity));
    };
    onLockChange();
    canvas.addEventListener("click", onClick);
    document.addEventListener("pointerlockchange", onLockChange);
    document.addEventListener("mousemove", onMouseMove);
    return () => {
      canvas.removeEventListener("click", onClick);
      document.removeEventListener("pointerlockchange", onLockChange);
      document.removeEventListener("mousemove", onMouseMove);
    };
  }, [enabled, gl, layout, lookSensitivity, ways]);

  // Only unmounting the controls means the lock state is no longer tracked.
  useEffect(() => () => usePalaceStore.getState().setPointerLocked(false), []);

  // Mode transitions: leaving walk releases the pointer; returning flies back to the last walk pose.
  useEffect(() => {
    const previous = wasEnabled.current;
    wasEnabled.current = enabled;
    if (previous === null || previous === enabled) return;
    if (!enabled) {
      if (document.pointerLockElement === gl.domElement) document.exitPointerLock();
      return;
    }
    const p = pose.current;
    const position: Vec3 = [p.x, EYE_HEIGHT, p.z];
    const target: Vec3 = [p.x - Math.sin(p.yaw) * Math.cos(p.pitch), EYE_HEIGHT + Math.sin(p.pitch), p.z - Math.cos(p.yaw) * Math.cos(p.pitch)];
    flyToPose(position, target);
  }, [enabled, gl]);

  useFrame((_, delta) => {
    if (!enabled) return;
    const p = pose.current;
    const flying = isFlying();
    if (flying) {
      wasFlying.current = true;
      return;
    }
    if (wasFlying.current) {
      // Adopt wherever the flight left the camera.
      wasFlying.current = false;
      const e = scratch.current.euler.setFromQuaternion(camera.quaternion, "YXZ");
      p.yaw = e.y;
      p.pitch = Math.max(-MAX_PITCH, Math.min(MAX_PITCH, e.x));
      p.x = camera.position.x;
      p.z = camera.position.z;
    }

    const held = keys.current;
    let forward = 0;
    let strafe = 0;
    for (const k of held) {
      if (FORWARD_KEYS.has(k)) forward += 1;
      if (BACK_KEYS.has(k)) forward -= 1;
      if (RIGHT_KEYS.has(k)) strafe += 1;
      if (LEFT_KEYS.has(k)) strafe -= 1;
    }
    if (forward !== 0 || strafe !== 0) {
      let running = false;
      for (const k of RUN_KEYS) if (held.has(k)) running = true;
      const speed = (running ? runSpeed : walkSpeed) * Math.min(delta, 0.1);
      const fx = -Math.sin(p.yaw);
      const fz = -Math.cos(p.yaw);
      const rx = Math.cos(p.yaw);
      const rz = -Math.sin(p.yaw);
      let dx = fx * forward + rx * strafe;
      let dz = fz * forward + rz * strafe;
      const len = Math.hypot(dx, dz) || 1;
      dx = (dx / len) * speed;
      dz = (dz / len) * speed;
      const [nx, nz] = moveWithCollision(walls, [p.x, p.z], [p.x + dx, p.z + dz]);
      p.x = nx;
      p.z = nz;
    }

    camera.position.set(p.x, EYE_HEIGHT, p.z);
    camera.rotation.set(p.pitch, p.yaw, 0, "YXZ");
  });

  return null;
}
