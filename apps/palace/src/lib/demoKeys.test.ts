import { describe, expect, it } from "vitest";
import { demoActionFor } from "./demoKeys";

describe("demoActionFor", () => {
  it("maps R and Shift+R to replay start and stop", () => {
    expect(demoActionFor({ key: "r" })).toBe("replay.start");
    expect(demoActionFor({ key: "R", shiftKey: true })).toBe("replay.stop");
  });
  it("maps the remaining demo keys", () => {
    expect(demoActionFor({ key: "j" })).toBe("journal");
    expect(demoActionFor({ key: "c" })).toBe("chart");
    expect(demoActionFor({ key: "f" })).toBe("fallback");
    expect(demoActionFor({ key: "v" })).toBe("voice");
    expect(demoActionFor({ key: "a" })).toBe("approve");
    expect(demoActionFor({ key: "b" })).toBe("browser");
  });
  it("ignores scene keys and modifier chords", () => {
    expect(demoActionFor({ key: "Tab" })).toBeNull();
    expect(demoActionFor({ key: "e" })).toBeNull();
    expect(demoActionFor({ key: "r", metaKey: true })).toBeNull();
    expect(demoActionFor({ key: "c", ctrlKey: true })).toBeNull();
    expect(demoActionFor({ key: "j", shiftKey: true })).toBeNull();
  });
});
