/**
 * Consolidation of a freshly extracted belief against existing ones. docs/spec.md > Belief extraction > Consolidation.
 *
 * 1. Exact match on (s, p, o): reinforce (c ← c + 0.3(1 − c) via @cortex/schema reinforce), append evidence.
 * 2. Near match: embedding cosine ≥ 0.9 on belief text: same as 1.
 * 3. Conflict: same (s, p), different o: open an update case. Human-sourced beats screen-sourced; newer evidence
 *    beats older. Loser gets status superseded, superseded_by set, a `supersedes` edge, history kept. Never deleted.
 * Otherwise: insert as new, c0 by source, belief_state row per condition, evidence edges.
 */
import type { Belief } from "@cortex/schema";
import { NotImplemented } from "../lib/errors.js";
import type { MemoryStore } from "../db/memory-store.js";

export type ConsolidationOutcome =
  | { kind: "reinforced"; belief_id: string }
  | { kind: "superseded"; winner_id: string; loser_id: string }
  | { kind: "inserted"; belief_id: string };

export interface Consolidator {
  consolidate(candidate: Belief, day: number): Promise<ConsolidationOutcome>;
}

export function createConsolidator(_store: MemoryStore): Consolidator {
  return {
    async consolidate() {
      throw new NotImplemented("consolidation");
    },
  };
}
