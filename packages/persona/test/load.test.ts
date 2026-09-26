import { describe, expect, it } from "vitest";
import { calendarSeed, groundTruth, inboxSeed, listings, mayaScript, usageLog } from "../src/index.js";

describe("persona data loads and validates", () => {
  it("every fixture parses against the schema", () => {
    expect(Array.isArray(listings())).toBe(true);
    expect(Array.isArray(mayaScript())).toBe(true);
    expect(Array.isArray(usageLog())).toBe(true);
    expect(Array.isArray(inboxSeed())).toBe(true);
    expect(Array.isArray(calendarSeed())).toBe(true);
    expect(groundTruth()).toMatchObject({ rules: [], questions: [] });
  });
});
