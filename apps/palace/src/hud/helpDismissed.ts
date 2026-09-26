"use client";
/**
 * Whether the controls help has been dismissed, remembered in localStorage. Exposed as an external
 * store (`useSyncExternalStore`) so the first client render already agrees with storage, with no
 * setState-in-effect and no hydration mismatch (the server snapshot is "not dismissed").
 */
import { useSyncExternalStore } from "react";

const KEY = "cortex.palace.helpDismissed";
const listeners = new Set<() => void>();

function read(): boolean {
  try {
    return window.localStorage.getItem(KEY) === "1";
  } catch {
    return false;
  }
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  const onStorage = (e: StorageEvent) => {
    if (e.key === null || e.key === KEY) listener();
  };
  window.addEventListener("storage", onStorage);
  return () => {
    listeners.delete(listener);
    window.removeEventListener("storage", onStorage);
  };
}

export function setHelpDismissed(dismissed: boolean): void {
  try {
    if (dismissed) window.localStorage.setItem(KEY, "1");
    else window.localStorage.removeItem(KEY);
  } catch {
    // Storage blocked (private mode, embedded preview): the in-memory listeners still update.
  }
  for (const listener of listeners) listener();
}

export function useHelpDismissed(): boolean {
  return useSyncExternalStore(subscribe, read, () => false);
}
