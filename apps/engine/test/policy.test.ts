import { describe, expect, it } from "vitest";
import { isNearDuplicate, shouldCapture } from "../src/ingest/policy.js";

describe("capture policy", () => {
  it("captures loads, submits and actionable clicks", () => {
    expect(shouldCapture({ kind: "load" })).toEqual({ capture: true, action: "load" });
    expect(shouldCapture({ kind: "submit" })).toEqual({ capture: true, action: "submit" });
    expect(shouldCapture({ kind: "click", actionable: true })).toEqual({ capture: true, action: "click" });
  });
  it("skips scroll, mousemove and clicks on dead elements", () => {
    expect(shouldCapture({ kind: "scroll" }).capture).toBe(false);
    expect(shouldCapture({ kind: "mousemove" }).capture).toBe(false);
    expect(shouldCapture({ kind: "click", actionable: false }).capture).toBe(false);
  });
  it("captures dwell only past the threshold", () => {
    expect(shouldCapture({ kind: "dwell", dwellSeconds: 9 }).capture).toBe(false);
    expect(shouldCapture({ kind: "dwell", dwellSeconds: 10 })).toEqual({ capture: true, action: "dwell" });
  });
  it("near-duplicate uses the phash distance threshold", () => {
    expect(isNearDuplicate("0000000000000000", null)).toBe(false);
    expect(isNearDuplicate("0000000000000000", "0000000000000003")).toBe(true);
    expect(isNearDuplicate("0000000000000000", "00000000000000ff")).toBe(false);
  });
});
