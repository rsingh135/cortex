import { describe, expect, it } from "vitest";
import { DEFAULT_PARAMS } from "@cortex/schema";
import { DEFAULT_INPUT, assertions, recallStateOn, simulate, suggestRecallDays } from "../simulate.js";

describe("simulator", () => {
  it("suggests the greedy recall schedule that keeps a day-2 L0 alive to day 24", () => {
    expect(suggestRecallDays(2, 24, DEFAULT_PARAMS)).toEqual([3, 6, 13]);
  });
  it("counts only recalls after creation and up to the observed day", () => {
    expect(recallStateOn(5, [3, 6, 13, 18], 24)).toEqual({ recalls: 3, lastRecallDay: 18 });
    expect(recallStateOn(5, [3, 6, 13, 18], 10)).toEqual({ recalls: 1, lastRecallDay: 6 });
  });
  it("keep_all bytes never decrease and cortex bytes level off", () => {
    const rows = simulate(DEFAULT_INPUT);
    for (let i = 1; i < rows.length; i++) expect(rows[i]!.bytes.keep_all).toBeGreaterThanOrEqual(rows[i - 1]!.bytes.keep_all);
    const last = rows[rows.length - 1]!;
    expect(last.bytes.cortex).toBeLessThan(last.bytes.keep_all);
  });
  it("every demo-beat assertion passes with the default parameters", () => {
    const failed = assertions(DEFAULT_INPUT).filter((a) => !a.ok);
    expect(failed, failed.map((f) => `${f.name}: ${f.detail}`).join("\n")).toEqual([]);
  });
});
