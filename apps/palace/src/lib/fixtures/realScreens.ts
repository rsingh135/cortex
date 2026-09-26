/**
 * Assigns the real MockLoft screenshots (public/captures, listed in captureManifest.ts) to fixture
 * captures so paintings show genuine screens. Deterministic: the day-2 hunt takes manifest entries in
 * recording order (matching app and action when possible); every other capture reuses its app's
 * entries cyclically. Apps with no recording (calendar) keep the canvas placeholder.
 */
import type { App } from "@cortex/schema";
import { CAPTURE_MANIFEST, type CaptureManifestEntry } from "./captureManifest";

export interface ScreenSource {
  app: App;
  /** Fixture capture group label; "hunt1" gets the recording in order. */
  group?: string;
}

const byApp = new Map<App, CaptureManifestEntry[]>();
for (const e of CAPTURE_MANIFEST) byApp.set(e.app, [...(byApp.get(e.app) ?? []), e]);

/** Real screenshot files for one app, in recording order. */
export function manifestFor(app: App): readonly CaptureManifestEntry[] {
  return byApp.get(app) ?? [];
}

/**
 * Walks captures in order and returns the real file for each (or null). `hunt1` captures consume the
 * day-2 recording sequentially; others cycle through their app's entries.
 */
export function assignRealScreens<T extends ScreenSource>(captures: readonly T[]): (string | null)[] {
  const huntCursor = new Map<App, number>();
  const cycleCursor = new Map<App, number>();
  return captures.map((c) => {
    const entries = manifestFor(c.app);
    if (entries.length === 0) return null;
    if (c.group === "hunt1") {
      const at = huntCursor.get(c.app) ?? 0;
      if (at < entries.length) {
        huntCursor.set(c.app, at + 1);
        return entries[at]!.file;
      }
    }
    const at = cycleCursor.get(c.app) ?? 0;
    cycleCursor.set(c.app, at + 1);
    return entries[at % entries.length]!.file;
  });
}
