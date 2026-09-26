/**
 * Store-less event bus for camera flights. Anyone (HUD minimap, door meshes, key handlers) calls
 * `flyTo(room)`; the `<DoorFly/>` component inside the Canvas performs the 700 ms tween and
 * publishes the flying flag so the controls stand down while the camera moves.
 */
import type { PalaceRoom, Vec3 } from "@/lib/types";

export const FLIGHT_DURATION_MS = 700;

export interface RoomFlight {
  kind: "room";
  room: PalaceRoom;
  durationMs: number;
}

export interface PoseFlight {
  kind: "pose";
  position: Vec3;
  target: Vec3;
  durationMs: number;
}

export type FlightRequest = RoomFlight | PoseFlight;
export type FlightListener = (request: FlightRequest) => void;
export type FlyingListener = (flying: boolean) => void;

const flightListeners = new Set<FlightListener>();
const flyingListeners = new Set<FlyingListener>();
let flying = false;

/** Fly the camera into a room (or the Archive), ending just inside its door facing the centre. */
export function flyTo(room: PalaceRoom, durationMs: number = FLIGHT_DURATION_MS): void {
  publish({ kind: "room", room, durationMs });
}

/** Fly the camera to an explicit position, looking at `target`. */
export function flyToPose(position: Vec3, target: Vec3, durationMs: number = FLIGHT_DURATION_MS): void {
  publish({ kind: "pose", position, target, durationMs });
}

export function subscribeFlight(listener: FlightListener): () => void {
  flightListeners.add(listener);
  return () => {
    flightListeners.delete(listener);
  };
}

export function isFlying(): boolean {
  return flying;
}

export function subscribeFlying(listener: FlyingListener): () => void {
  flyingListeners.add(listener);
  return () => {
    flyingListeners.delete(listener);
  };
}

/** Called by the flight driver only. */
export function markFlying(next: boolean): void {
  if (flying === next) return;
  flying = next;
  for (const l of flyingListeners) l(next);
}

function publish(request: FlightRequest): void {
  for (const l of flightListeners) l(request);
}
