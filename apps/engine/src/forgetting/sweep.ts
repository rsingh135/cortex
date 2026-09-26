/** Applies a SweepPlan to the database through the Repo. Emits nothing; the change stream does. */
import type { Condition } from "@cortex/schema";
import { NotImplemented } from "../lib/errors.js";
import type { Repo } from "../db/repo.js";
import type { SweepPlan } from "./plan.js";

export interface Sweeper {
  /** Advance the clock to `day` and run the sweep for the given conditions. */
  advance(day: number, conditions: Condition[]): Promise<SweepPlan[]>;
  apply(plan: SweepPlan): Promise<void>;
}

export function createSweeper(_repo: Repo): Sweeper {
  return {
    async advance() {
      // for each condition: captureStates + beliefStates + belief meta → planSweep → apply; then repo.setDay
      throw new NotImplemented("forgetting/sweep.advance");
    },
    async apply() {
      // repo.deleteLevels per capture (only in the demo/cortex DB when levels are physically stored),
      // repo.updateCaptureState, repo.updateBeliefState; write a daily_stats row
      throw new NotImplemented("forgetting/sweep.apply");
    },
  };
}
