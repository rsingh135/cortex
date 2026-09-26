/**
 * Propagation: on preference upsert, $graphLookup over uses/derived_from for changed beliefs plus procedures.find({room, decision_attributes: attr}) for new ones; mark cracked and append to the decide step's uses; heal on the next successful run. docs/spec.md > Voice notes and updates > Propagation.
 */
import { NotImplemented } from "../lib/errors.js";
import type { Repo } from "../db/repo.js";

export interface PropagationModule {
  run(...args: unknown[]): Promise<never>;
}

export function createPropagation(_repo: Repo): PropagationModule {
  return {
    async run() {
      throw new NotImplemented("propagation");
    },
  };
}
