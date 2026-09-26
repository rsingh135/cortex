import { describe, expect, it } from "vitest";
import { captureFromDoc } from "./adapt";

const base = { _id: "c1", episode_id: "ep", day: 2, ts: "2026-09-26T00:00:00.000Z", actor: "maya" as const, app: "mockloft" as const, url: "/listings", title: "t", action: { type: "load" as const }, phash: "p", extracted: true, belief_ids: [], l0_bytes: 150000 };
const resolver = (c: { id: string }) => `resolved:${c.id}`;

describe("captureFromDoc", () => {
  it("prefers a bundled image_url over the texture resolver", () => {
    const c = captureFromDoc({ ...base, image_url: "/captures/001.webp" }, 2, resolver);
    expect(c.textureUrl).toBe("/captures/001.webp");
    expect(c.aliveLevels).toEqual(["L0", "L1", "L2", "L3"]);
  });
  it("falls back to the resolver without image_url, and to null when forgotten", () => {
    expect(captureFromDoc(base, 2, resolver).textureUrl).toBe("resolved:c1");
    expect(captureFromDoc({ ...base, image_url: "" }, 2, resolver).textureUrl).toBe("resolved:c1");
    const gone = captureFromDoc({ ...base, alive_levels: [], ceiling: null, clarity: 0, image_url: "/captures/001.webp" }, 24, resolver);
    expect(gone.textureUrl).toBeNull();
  });
});
