import { describe, expect, it } from "vitest";
import { tokenizeJson } from "./jsonTokens";

describe("tokenizeJson", () => {
  it("round-trips the input text", () => {
    const src = JSON.stringify({ day: 24, rooms: [{ name: "Housing", top: ['She said "hi"', "x\\y"], cracked: [] }], ok: true, none: null, n: -1.5e3 }, null, 2);
    expect(
      tokenizeJson(src)
        .map((t) => t.text)
        .join(""),
    ).toBe(src);
  });

  it("tells keys from string values and classifies numbers and literals", () => {
    const tokens = tokenizeJson('{"name": "Housing", "beliefs": 40, "ok": true, "none": null}').filter((t) => t.type !== "whitespace" && t.type !== "punctuation");
    expect(tokens).toEqual([
      { type: "key", text: '"name"' },
      { type: "string", text: '"Housing"' },
      { type: "key", text: '"beliefs"' },
      { type: "number", text: "40" },
      { type: "key", text: '"ok"' },
      { type: "literal", text: "true" },
      { type: "key", text: '"none"' },
      { type: "literal", text: "null" },
    ]);
  });

  it("keeps escaped quotes inside one string token", () => {
    const [token] = tokenizeJson('"a \\"quoted\\" word"');
    expect(token).toEqual({ type: "string", text: '"a \\"quoted\\" word"' });
  });
});
