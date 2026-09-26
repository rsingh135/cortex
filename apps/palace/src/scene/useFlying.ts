"use client";
/** React view of the flight flag published by `flyBus`. */
import { useSyncExternalStore } from "react";
import { isFlying, subscribeFlying } from "./flyBus";

const getServerSnapshot = () => false;

export function useFlying(): boolean {
  return useSyncExternalStore(subscribeFlying, isFlying, getServerSnapshot);
}
