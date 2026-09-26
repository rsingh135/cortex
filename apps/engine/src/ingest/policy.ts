/**
 * WHEN to capture. Pure decision from docs/spec.md > Capture pipeline:
 * capture on page load, click on a link/button/listing, form submit or message sent, and dwell of 10s+;
 * never on scroll alone; skip frames whose perceptual hash is within a small distance of the previous capture.
 */
import { hammingDistance } from "./phash.js";
import type { ActionType } from "@cortex/schema";

export interface CaptureSignal {
  /** Raw browser signal; "scroll" and "mousemove" never capture. */
  kind: ActionType | "scroll" | "mousemove";
  /** For dwell: seconds on the same page. */
  dwellSeconds?: number;
  /** For click: does the element navigate or act (link, button, listing card)? */
  actionable?: boolean;
}

export interface PolicyConfig {
  dwellThresholdSeconds: number;
  /** Max Hamming distance to the previous capture that still counts as "nearly identical". */
  phashDistanceThreshold: number;
}

export const DEFAULT_POLICY: PolicyConfig = { dwellThresholdSeconds: 10, phashDistanceThreshold: 4 };

export type Decision = { capture: true; action: ActionType } | { capture: false; reason: string };

/** Step 1: does the signal itself warrant a capture? */
export function shouldCapture(signal: CaptureSignal, cfg: PolicyConfig = DEFAULT_POLICY): Decision {
  switch (signal.kind) {
    case "load":
      return { capture: true, action: "load" };
    case "submit":
      return { capture: true, action: "submit" };
    case "click":
      return signal.actionable === false ? { capture: false, reason: "click on non-actionable element" } : { capture: true, action: "click" };
    case "dwell":
      return (signal.dwellSeconds ?? 0) >= cfg.dwellThresholdSeconds
        ? { capture: true, action: "dwell" }
        : { capture: false, reason: `dwell ${signal.dwellSeconds ?? 0}s under ${cfg.dwellThresholdSeconds}s` };
    case "scroll":
    case "mousemove":
      return { capture: false, reason: `${signal.kind} never captures` };
  }
}

/** Step 2: after hashing, is the frame a near-duplicate of the previous capture? */
export function isNearDuplicate(hash: string, previousHash: string | null, cfg: PolicyConfig = DEFAULT_POLICY): boolean {
  if (previousHash === null) return false;
  return hammingDistance(hash, previousHash) <= cfg.phashDistanceThreshold;
}
