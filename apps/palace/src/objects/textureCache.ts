"use client";
/**
 * Process-wide texture cache keyed by a capture's `textureUrl` (fixture screen keys, or engine image
 * URLs live). A fixture key is rasterised in idle time by `lib/fixtures/screenUrl` and its data URL
 * loaded from there; a real URL loads directly. Exposed to React through `useSyncExternalStore`, so
 * a component never sets state in an effect and a texture that is already loaded renders on the
 * first frame. Tolerates null URLs and load failures (both read as "no texture"). Oldest idle
 * entries are evicted beyond `MAX_ENTRIES`.
 */
import { useCallback, useSyncExternalStore } from "react";
import * as THREE from "three";
import { isFixtureScreenKey, isScreenUrlSettled, peekScreenUrl, requestScreenUrl } from "@/lib/fixtures/screenUrl";

interface Entry {
  texture: THREE.Texture | null;
  failed: boolean;
}

const MAX_ENTRIES = 512;
const entries = new Map<string, Entry>();
const listeners = new Map<string, Set<() => void>>();
let loader: THREE.TextureLoader | null = null;

function notify(url: string): void {
  listeners.get(url)?.forEach((cb) => cb());
}

function evict(): void {
  if (entries.size <= MAX_ENTRIES) return;
  for (const [url, entry] of entries) {
    if (entries.size <= MAX_ENTRIES) return;
    if (listeners.get(url)?.size) continue;
    entry.texture?.dispose();
    entries.delete(url);
  }
}

function fail(url: string): void {
  const entry = entries.get(url);
  if (entry) entry.failed = true;
  notify(url);
}

/** Load the image at `src` into the entry for `url` (they differ for fixture keys). */
function load(url: string, src: string): void {
  loader ??= new THREE.TextureLoader();
  loader.load(
    src,
    (texture) => {
      const entry = entries.get(url);
      if (!entry) {
        texture.dispose();
        return;
      }
      texture.colorSpace = THREE.SRGBColorSpace;
      texture.minFilter = THREE.LinearFilter;
      texture.magFilter = THREE.LinearFilter;
      texture.generateMipmaps = false;
      texture.wrapS = THREE.ClampToEdgeWrapping;
      texture.wrapT = THREE.ClampToEdgeWrapping;
      entry.texture = texture;
      notify(url);
    },
    undefined,
    () => fail(url),
  );
}

function ensure(url: string): void {
  if (entries.has(url)) return;
  entries.set(url, { texture: null, failed: false });
  evict();
  if (!isFixtureScreenKey(url)) {
    load(url, url);
    return;
  }
  const ready = peekScreenUrl(url);
  if (ready) {
    load(url, ready);
    return;
  }
  if (isScreenUrlSettled(url)) {
    fail(url);
    return;
  }
  const stop = requestScreenUrl(url, () => {
    stop();
    if (!entries.has(url)) return;
    const drawn = peekScreenUrl(url);
    if (drawn) load(url, drawn);
    else fail(url);
  });
}

/** The loaded texture for `url`, or null while loading, after failure, or for a null URL. */
export function peekTexture(url: string | null): THREE.Texture | null {
  return url ? (entries.get(url)?.texture ?? null) : null;
}

/** Start loading `url` (if needed) and be told when its entry changes. */
export function subscribeTexture(url: string, callback: () => void): () => void {
  ensure(url);
  let set = listeners.get(url);
  if (!set) {
    set = new Set();
    listeners.set(url, set);
  }
  set.add(callback);
  return () => {
    const current = listeners.get(url);
    current?.delete(callback);
    if (current && current.size === 0) listeners.delete(url);
  };
}

const noop = (): void => {};
const unsubscribeNoop = (): (() => void) => noop;
const nullTexture = (): THREE.Texture | null => null;

/** Cached texture for a capture URL; null until loaded or when there is nothing to show. */
export function useCachedTexture(url: string | null): THREE.Texture | null {
  const subscribe = useCallback((callback: () => void) => (url ? subscribeTexture(url, callback) : unsubscribeNoop()), [url]);
  const getSnapshot = useCallback(() => peekTexture(url), [url]);
  return useSyncExternalStore(subscribe, getSnapshot, nullTexture);
}

/** Drop every cached texture (tests, hot reload). */
export function clearTextureCache(): void {
  for (const entry of entries.values()) entry.texture?.dispose();
  entries.clear();
}
