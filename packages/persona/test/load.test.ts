import { describe, expect, it } from "vitest";
import { calendarSeed, groundTruth, inboxSeed, listings, mayaScript, usageLog } from "../src/index.js";
import { generatePersona } from "../src/generate/index.js";

describe("persona data files", () => {
  it("parse against the schema and match the generator's default seed (run `pnpm --filter @cortex/persona generate` after changing it)", () => {
    const p = generatePersona();
    expect(listings()).toEqual(p.listings);
    expect(mayaScript()).toEqual(p.script);
    expect(groundTruth()).toEqual(p.groundTruth);
    expect(usageLog()).toEqual(p.usageLog);
    expect(inboxSeed()).toEqual(p.inbox);
    expect(calendarSeed()).toEqual(p.calendar);
  });
});
