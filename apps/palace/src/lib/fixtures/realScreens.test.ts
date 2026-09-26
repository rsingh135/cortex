import { describe, expect, it } from "vitest";
import { CAPTURE_MANIFEST } from "./captureManifest";
import { assignRealScreens, manifestFor } from "./realScreens";
import { generateFixture } from "./generate";
import { fixtureScreenKey, isFixtureScreenKey } from "./screenUrl";

describe("assignRealScreens", () => {
  it("gives the day-2 hunt the recording in order, cycles for everyone else, and skips apps with no recording", () => {
    const mock = manifestFor("mockloft");
    expect(mock.length).toBeGreaterThan(5);
    const captures = [
      { app: "mockloft" as const, group: "hunt1" },
      { app: "mockloft" as const, group: "hunt1" },
      { app: "mockloft" as const, group: "hunt2" },
      { app: "mockloft" as const, group: "hunt2" },
      { app: "calendar" as const, group: "life3" },
    ];
    const files = assignRealScreens(captures);
    expect(files.slice(0, 2)).toEqual([mock[0]!.file, mock[1]!.file]);
    expect(files.slice(2, 4)).toEqual([mock[0]!.file, mock[1]!.file]);
    // Apps present in the recording get a file; apps absent from it get null.
    const calendarRecorded = manifestFor("calendar").length > 0;
    if (calendarRecorded) expect(files[4]).toBe(manifestFor("calendar")[0]!.file);
    else expect(files[4]).toBeNull();
    expect(assignRealScreens([{ app: "landlord_chat" as const, group: "x" }])[0] !== null).toBe(manifestFor("landlord_chat").length > 0);
    for (const f of files.filter(Boolean)) expect(CAPTURE_MANIFEST.some((e) => e.file === f)).toBe(true);
  });
});

describe("fixture textures", () => {
  const snapshot = generateFixture(42);
  it("hangs real screenshots for recorded apps and keeps the placeholder key for the rest", () => {
    const shown = snapshot.captures.filter((c) => c.ceiling !== null);
    const real = shown.filter((c) => c.textureUrl?.startsWith("/captures/"));
    const placeholder = shown.filter((c) => c.textureUrl !== null && isFixtureScreenKey(c.textureUrl));
    expect(real.length).toBeGreaterThan(shown.length / 2);
    const recordedApps = new Set(CAPTURE_MANIFEST.map((e) => e.app));
    expect(real.every((c) => recordedApps.has(c.app))).toBe(true);
    expect(placeholder.every((c) => !recordedApps.has(c.app))).toBe(true);
    for (const c of shown) expect(c.textureUrl).toBe(fixtureScreenKey(c, 42));
    expect(snapshot.captures.filter((c) => c.ceiling === null).every((c) => c.textureUrl === null)).toBe(true);
  });
  it("day-2 mockloft captures follow the recording order", () => {
    const first = manifestFor("mockloft")
      .slice(0, 3)
      .map((e) => e.file);
    const hunt1 = snapshot.captures.filter((c) => c.day === 2 && c.app === "mockloft").map((c) => c.screenFile);
    expect(hunt1.slice(0, 3)).toEqual(first);
  });
});
