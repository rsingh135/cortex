import { describe, expect, it } from "vitest";
import { easeOutCubic, quantize, tweenAt } from "./tween";

describe("tweenAt", () => {
  it("starts at from and lands exactly on to", () => {
    expect(tweenAt(0, 100, 0, 500)).toEqual({ value: 0, done: false });
    expect(tweenAt(0, 100, 500, 500)).toEqual({ value: 100, done: true });
    expect(tweenAt(0, 100, 900, 500)).toEqual({ value: 100, done: true });
  });

  it("is monotonic and decelerating with the default easing", () => {
    let previous = 0;
    let previousStep = Infinity;
    for (let ms = 50; ms <= 500; ms += 50) {
      const { value } = tweenAt(0, 100, ms, 500);
      expect(value).toBeGreaterThan(previous);
      const step = value - previous;
      expect(step).toBeLessThanOrEqual(previousStep + 1e-9);
      previous = value;
      previousStep = step;
    }
  });

  it("tweens downwards too", () => {
    const { value } = tweenAt(100, 0, 250, 500);
    expect(value).toBeLessThan(100);
    expect(value).toBeGreaterThan(0);
  });

  it("snaps when the duration is zero or the start is not a number", () => {
    expect(tweenAt(3, 7, 0, 0)).toEqual({ value: 7, done: true });
    expect(tweenAt(Number.NaN, 7, 10, 500).value).toBe(7);
  });

  it("accepts a custom easing", () => {
    const linear = (t: number) => t;
    expect(tweenAt(0, 10, 250, 500, linear).value).toBeCloseTo(5);
    expect(easeOutCubic(0.5)).toBeCloseTo(0.875);
  });
});

describe("quantize", () => {
  it("rounds to the requested decimals", () => {
    expect(quantize(6.43219, 1)).toBe(6.4);
    expect(quantize(0.8449, 2)).toBe(0.84);
    expect(quantize(12.7, 0)).toBe(13);
  });
});
