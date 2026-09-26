import { describe, expect, it } from "vitest";
import { renderChart, rowsFromStats, simulatedRows } from "./chart";

describe("chart", () => {
  const rows = simulatedRows();

  it("simulates 30 days where keep_all never shrinks and cortex ends far below it", () => {
    expect(rows).toHaveLength(30);
    for (let i = 1; i < rows.length; i++) expect(rows[i]!.bytes.keep_all).toBeGreaterThanOrEqual(rows[i - 1]!.bytes.keep_all);
    const last = rows[rows.length - 1]!;
    expect(last.bytes.cortex).toBeLessThan(0.25 * last.bytes.keep_all);
    expect(last.bytes.blur_by_age).toBeLessThan(last.bytes.cortex);
  });

  it("renders one path per strategy and marks accuracy pending without eval data", () => {
    const svg = renderChart(rows, null);
    expect(svg.startsWith("<svg")).toBe(true);
    expect((svg.match(/<path /g) ?? []).length).toBe(3);
    expect(svg).toContain("Evaluation pending");
    expect(svg).toContain("Keep everything");
  });

  it("draws accuracy lines when rows carry accuracy", () => {
    const acc = [5, 10, 15].flatMap((day) => [
      { condition: "keep_all" as const, day, accuracy_weighted: 0.9 },
      { condition: "blur_by_age" as const, day, accuracy_weighted: 0.7 },
      { condition: "cortex" as const, day, accuracy_weighted: 0.88 },
    ]);
    const svg = renderChart(rows, acc);
    expect((svg.match(/<path /g) ?? []).length).toBe(6);
    expect(svg).not.toContain("Evaluation pending");
  });

  it("folds engine stats rows into chart rows and accuracy points", () => {
    const { rows: r, accuracy } = rowsFromStats([
      { condition: "cortex", day: 1, image_bytes: 100, belief_bytes: 10, accuracy_weighted: null },
      { condition: "keep_all", day: 1, image_bytes: 200, belief_bytes: 10, accuracy_weighted: null },
      { condition: "cortex", day: 5, image_bytes: 90, belief_bytes: 12, accuracy_weighted: 0.8 },
    ]);
    expect(r.map((x) => x.day)).toEqual([1, 5]);
    expect(r[0]!.bytes).toEqual({ cortex: 110, keep_all: 210, blur_by_age: 0 });
    expect(accuracy).toEqual([{ condition: "cortex", day: 5, accuracy_weighted: 0.8 }]);
    expect(rowsFromStats([]).accuracy).toBeNull();
  });
});
