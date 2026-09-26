import { describe, expect, it } from "vitest";
import { renderChart } from "../chart";
import { DEFAULT_INPUT, simulate } from "../simulate";

describe("chart", () => {
  const rows = simulate(DEFAULT_INPUT);
  it("renders one path per strategy in the bytes panel and marks accuracy pending without eval data", () => {
    const svg = renderChart(rows, null);
    expect(svg.startsWith("<svg")).toBe(true);
    expect((svg.match(/<path /g) ?? []).length).toBe(3);
    expect(svg).toContain("Evaluation pending");
    expect(svg).toContain("Keep everything");
    expect(svg).toContain("Cortex");
  });
  it("draws accuracy lines when eval rows are supplied", () => {
    const acc = [5, 10, 15, 20, 25, 30].flatMap((day) => [
      { condition: "keep_all" as const, day, accuracy_weighted: 0.9 },
      { condition: "blur_by_age" as const, day, accuracy_weighted: 0.9 - day / 100 },
      { condition: "cortex" as const, day, accuracy_weighted: 0.88 },
    ]);
    const svg = renderChart(rows, acc);
    expect((svg.match(/<path /g) ?? []).length).toBe(6);
    expect(svg).not.toContain("Evaluation pending");
  });
});
