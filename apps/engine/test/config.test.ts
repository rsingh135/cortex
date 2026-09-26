import { describe, expect, it } from "vitest";
import { loadConfig } from "../src/config.js";

const good = { ATLAS_URI: "mongodb://x", ANTHROPIC_API_KEY: "k", CORTEX_WRITE_TOKEN: "t" };

describe("loadConfig", () => {
  it("applies defaults", () => {
    const c = loadConfig(good);
    expect(c.ATLAS_DB).toBe("cortex");
    expect(c.ENGINE_PORT).toBe(4000);
    expect(c.EXTRACTION_MODEL).toBe("claude-sonnet-5");
    expect(c.REASONING_MODEL).toBe("claude-opus-5");
  });
  it("names every missing variable", () => {
    expect(() => loadConfig({})).toThrow(/ATLAS_URI/);
    expect(() => loadConfig({})).toThrow(/ANTHROPIC_API_KEY/);
  });
});
