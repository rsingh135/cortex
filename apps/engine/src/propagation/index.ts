/**
 * Propagation: on preference upsert, walk uses/derived_from edges for changed beliefs plus procedures matching {room, decision_attributes: attr} for new ones; mark cracked and append to the decide step's uses; heal on the next successful run. docs/spec.md > Voice notes and updates > Propagation.
 */
import { NotImplemented } from "../lib/errors.js";
import type { MemoryStore } from "../db/memory-store.js";

export interface PropagationModule {
  run(...args: unknown[]): Promise<never>;
}

export function createPropagation(_store: MemoryStore): PropagationModule {
  return {
    async run() {
      throw new NotImplemented("propagation");
    },
  };
}
