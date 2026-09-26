import { describe, expect, it } from "vitest";
import sharp from "sharp";
import { buildLadder, degradeForServing } from "../src/ladder/index.js";
import { testImage } from "./helpers.js";

describe("resolution ladder", () => {
  it("builds four WebP rungs at 1, 1/2, 1/4, 1/8 with decreasing bytes", async () => {
    const rungs = await buildLadder(await testImage(1280, 800, 2));
    expect(rungs.map((r) => r.level)).toEqual(["L0", "L1", "L2", "L3"]);
    expect(rungs.map((r) => [r.width, r.height])).toEqual([[1280, 800], [640, 400], [320, 200], [160, 100]]);
    for (let i = 1; i < rungs.length; i++) expect(rungs[i]!.bytes).toBeLessThan(rungs[i - 1]!.bytes);
    for (const r of rungs) {
      expect(r.bytes).toBe(r.data.byteLength);
      expect((await sharp(r.data).metadata()).format).toBe("webp");
    }
  });
  it("degrades a rung for serving at a lower level without changing its dimensions", async () => {
    const [l0] = await buildLadder(await testImage(640, 400, 3));
    const served = await degradeForServing(l0!, "L2");
    const meta = await sharp(served).metadata();
    expect([meta.width, meta.height]).toEqual([640, 400]);
    expect(await degradeForServing(l0!, "L0")).toBe(l0!.data);
  });
});
