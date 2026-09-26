/**
 * Workflow learner: repeated-episode detection, rule proposal (claude-opus-5), code check with @cortex/schema checkRules, procedure + preference + style beliefs with derived_from/uses edges. docs/spec.md > Workflow learning.
 */
import { NotImplemented } from "../lib/errors.js";
import type { MemoryStore } from "../db/memory-store.js";

export interface LearnerModule {
  run(...args: unknown[]): Promise<never>;
}

export function createLearner(_store: MemoryStore): LearnerModule {
  return {
    async run() {
      throw new NotImplemented("learner");
    },
  };
}
