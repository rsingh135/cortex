"use client";
/**
 * Animates a number toward its target on a requestAnimationFrame loop, so counters tick instead of
 * jumping. Interruptible: a new target retargets from wherever the tween is. Honors reduced motion
 * by snapping.
 */
import { useEffect, useRef, useState } from "react";
import { quantize, tweenAt } from "@/lib/tween";

export interface TweenOptions {
  /** Milliseconds for the full move (default 700). */
  durationMs?: number;
  /** Decimal places kept while animating so the formatter never shows float dust (default 2). */
  digits?: number;
  /** Where to start on first mount (default: the target, no count-up). */
  from?: number;
}

function prefersReducedMotion(): boolean {
  return typeof window !== "undefined" && typeof window.matchMedia === "function" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

export function useTweenedNumber(target: number, { durationMs = 700, digits = 2, from }: TweenOptions = {}): number {
  const [value, setValue] = useState(() => (from === undefined ? target : from));
  const shown = useRef(value);
  shown.current = value;

  useEffect(() => {
    if (shown.current === target) return;
    if (prefersReducedMotion() || durationMs <= 0) {
      setValue(target);
      return;
    }
    const start = performance.now();
    const origin = shown.current;
    let frame = requestAnimationFrame(function step(now) {
      const { value: next, done } = tweenAt(origin, target, now - start, durationMs);
      setValue(done ? target : quantize(next, digits));
      if (!done) frame = requestAnimationFrame(step);
    });
    return () => cancelAnimationFrame(frame);
  }, [target, durationMs, digits]);

  return value;
}
