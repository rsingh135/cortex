import { describe, expect, it } from "vitest";
import sharp from "sharp";
import { hammingDistance, phash } from "../src/ingest/phash.js";
import { testImage } from "./helpers.js";

describe("phash", () => {
  it("is a 16-hex-char hash and stable across re-encoding", async () => {
    const png = await testImage(640, 400, 1);
    const webp = await sharp(png).webp({ quality: 80 }).toBuffer();
    const a = await phash(png);
    const b = await phash(webp);
    expect(a).toMatch(/^[0-9a-f]{16}$/);
    expect(hammingDistance(a, b)).toBeLessThanOrEqual(4);
  });
  it("differs for a different layout", async () => {
    const a = await phash(await testImage(640, 400, 1));
    const b = await phash(await testImage(640, 400, 7));
    expect(hammingDistance(a, b)).toBeGreaterThan(4);
  });
  it("hamming distance counts bits", () => {
    expect(hammingDistance("0000000000000000", "000000000000000f")).toBe(4);
    expect(hammingDistance("ffffffffffffffff", "ffffffffffffffff")).toBe(0);
  });
});
