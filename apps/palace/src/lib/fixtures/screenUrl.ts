"use client";
/**
 * Fixture screenshot keys. In fixture mode a capture's `textureUrl` is a cheap, self-describing key
 * (`fixture:<seed>:<ceiling>:<app>:<id>:<title>`) instead of a rasterised data URL, so store actions
 * (connect, setDay, the reducer) never touch a canvas. Consumers (the painting texture cache, HUD
 * thumbnails) resolve a key to a data URL here: lazily, memoised, and drawn in idle time so scrubbing
 * the timeline never freezes the main thread. Real captures keep using plain URLs, which pass through.
 */
import { APPS, LEVELS, type App, type Level } from "@cortex/schema";
import { useCallback, useSyncExternalStore } from "react";
import type { PalaceCapture } from "../types";
import { placeholderScreenshot } from "./screens";

export const FIXTURE_SCREEN_PREFIX = "fixture:";
/** Resolved data URLs kept in memory; the oldest unwatched ones are dropped past this. */
const MAX_RESOLVED = 400;
/** Idle budget per pump in ms when the browser gives no `IdleDeadline`. */
const FALLBACK_BUDGET_MS = 8;
const MIN_IDLE_REMAINING_MS = 4;

export type ScreenCapture = Pick<PalaceCapture, "id" | "app" | "title" | "ceiling"> & { screenFile?: string };
export type ScreenPriority = "normal" | "high";

/**
 * The texture source for a fixture capture: its real recorded screenshot when one was assigned
 * (a plain URL the texture cache loads directly), else a placeholder key; null when forgotten.
 * Clarity and ceiling still drive the blur shader either way.
 */
export function fixtureScreenKey(capture: ScreenCapture, seed: number): string | null {
  if (capture.ceiling === null) return null;
  if (capture.screenFile) return capture.screenFile;
  return `${FIXTURE_SCREEN_PREFIX}${seed >>> 0}:${capture.ceiling}:${capture.app}:${encodeURIComponent(capture.id)}:${encodeURIComponent(capture.title)}`;
}

export function isFixtureScreenKey(url: string): boolean {
  return url.startsWith(FIXTURE_SCREEN_PREFIX);
}

function isLevel(s: string): s is Level {
  return (LEVELS as readonly string[]).includes(s);
}

function isApp(s: string): s is App {
  return (APPS as readonly string[]).includes(s);
}

/** Inverse of `fixtureScreenKey`; null for anything that is not a well-formed key. */
export function parseFixtureScreenKey(key: string): { seed: number; capture: ScreenCapture } | null {
  if (!isFixtureScreenKey(key)) return null;
  const parts = key.slice(FIXTURE_SCREEN_PREFIX.length).split(":");
  if (parts.length !== 5) return null;
  const [seedText, ceiling, app, id, title] = parts;
  const seed = Number(seedText);
  if (!Number.isInteger(seed) || seed < 0 || !isLevel(ceiling) || !isApp(app) || id === "") return null;
  try {
    return { seed, capture: { id: decodeURIComponent(id), title: decodeURIComponent(title), app, ceiling } };
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// Lazy, memoised rasterisation
// ---------------------------------------------------------------------------

/** key -> data URL, or null once rasterisation was attempted and produced nothing (no DOM, bad key). */
const resolved = new Map<string, string | null>();
const waiters = new Map<string, Set<() => void>>();
const queue: string[] = [];
let pumpScheduled = false;

function notify(key: string): void {
  waiters.get(key)?.forEach((cb) => cb());
}

function trimResolved(): void {
  if (resolved.size <= MAX_RESOLVED) return;
  for (const key of resolved.keys()) {
    if (resolved.size <= MAX_RESOLVED) return;
    if (waiters.get(key)?.size) continue;
    resolved.delete(key);
  }
}

function rasterise(key: string): string | null {
  const parsed = parseFixtureScreenKey(key);
  const url = parsed ? placeholderScreenshot(parsed.capture, parsed.seed) : null;
  resolved.set(key, url);
  trimResolved();
  notify(key);
  return url;
}

function pump(deadline: IdleDeadline | null): void {
  pumpScheduled = false;
  const start = performance.now();
  while (queue.length > 0) {
    const key = queue.shift();
    if (key !== undefined && !resolved.has(key)) rasterise(key);
    const remaining = deadline ? deadline.timeRemaining() : FALLBACK_BUDGET_MS - (performance.now() - start);
    if (remaining < MIN_IDLE_REMAINING_MS) break;
  }
  schedulePump();
}

function schedulePump(): void {
  if (pumpScheduled || queue.length === 0 || typeof window === "undefined") return;
  pumpScheduled = true;
  if (typeof window.requestIdleCallback === "function") window.requestIdleCallback(pump, { timeout: 300 });
  else window.setTimeout(() => pump(null), 0);
}

function enqueue(key: string, priority: ScreenPriority): void {
  if (resolved.has(key)) return;
  const at = queue.indexOf(key);
  if (priority === "high") {
    if (at >= 0) queue.splice(at, 1);
    queue.unshift(key);
  } else if (at < 0) {
    queue.push(key);
  }
  schedulePump();
}

/** The resolved data URL for a key, or null while it is pending or when it cannot be drawn. */
export function peekScreenUrl(key: string): string | null {
  return resolved.get(key) ?? null;
}

/** True once rasterisation of `key` has been attempted (successfully or not). */
export function isScreenUrlSettled(key: string): boolean {
  return resolved.has(key);
}

/**
 * Ask for `key` to be drawn in idle time and be told when it settles. HUD thumbnails pass `high` so
 * they jump the queue ahead of paintings the visitor may never look at.
 */
export function requestScreenUrl(key: string, callback: () => void, priority: ScreenPriority = "normal"): () => void {
  let set = waiters.get(key);
  if (!set) {
    set = new Set();
    waiters.set(key, set);
  }
  set.add(callback);
  enqueue(key, priority);
  return () => {
    const current = waiters.get(key);
    current?.delete(callback);
    if (current && current.size === 0) waiters.delete(key);
  };
}

/** Draw `key` right now (tests, one-off exports). Prefer `requestScreenUrl` in UI code. */
export function resolveScreenUrlNow(key: string): string | null {
  if (resolved.has(key)) return resolved.get(key) ?? null;
  return rasterise(key);
}

/** Forget every resolved screen (tests, hot reload). */
export function clearScreenUrls(): void {
  resolved.clear();
  queue.length = 0;
}

const noop = (): void => {};
const unsubscribeNoop = (): (() => void) => noop;

/**
 * A browser-loadable URL for a capture's `textureUrl`: real URLs pass through unchanged, fixture keys
 * resolve to a data URL once drawn (null until then).
 */
export function useScreenUrl(url: string | null, priority: ScreenPriority = "high"): string | null {
  const key = url !== null && isFixtureScreenKey(url) ? url : null;
  const subscribe = useCallback((callback: () => void) => (key ? requestScreenUrl(key, callback, priority) : unsubscribeNoop()), [key, priority]);
  const getSnapshot = useCallback(() => (key ? peekScreenUrl(key) : url), [key, url]);
  const getServerSnapshot = useCallback(() => (key ? null : url), [key, url]);
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}
