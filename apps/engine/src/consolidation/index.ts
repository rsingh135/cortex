/**
 * Consolidation of a freshly extracted belief against existing ones. docs/spec.md > Belief extraction > Consolidation.
 *
 * 1. Exact match on (s, p, o): reinforce (c ← c + 0.3(1 − c) via @cortex/schema reinforce) in every condition,
 *    append the new evidence and an evidence edge. Implemented here, pure over MemoryData.
 * 2. Near match: embedding cosine ≥ 0.9 on belief text: same as 1. TODO(memory track): $vectorSearch over
 *    beliefs.embedding using src/recall/embed.ts once vectors are stored.
 * 3. Conflict: same (s, p), different o: open an update case. Human-sourced beats screen-sourced; newer evidence
 *    beats older. Loser gets status superseded, superseded_by set, a `supersedes` edge, history kept. Never deleted.
 *    TODO(memory track): only voice/manual sources create conflicts today; screen sightings never supersede.
 * Otherwise: insert as new with evidence edges. The caller adds belief_state rows per condition.
 */
import { reinforce, type Belief } from "@cortex/schema";
import type { MemoryData } from "../db/memory-data.js";
import { newId } from "../lib/ids.js";

export type ConsolidationOutcome = { kind: "reinforced"; belief_id: string } | { kind: "inserted"; belief_id: string };

function sameTriple(a: Belief["triple"], b: Belief["triple"]): boolean {
  return a.p === b.p && a.s.toLowerCase() === b.s.toLowerCase() && a.o.toLowerCase() === b.o.toLowerCase();
}

export function consolidateExact(data: MemoryData, candidate: Belief, captureId: string): ConsolidationOutcome {
  const existing = data.beliefs.find((b) => sameTriple(b.triple, candidate.triple));
  if (existing) {
    const alreadyEvidence = existing.evidence.includes(captureId);
    if (!alreadyEvidence) {
      existing.evidence.push(captureId);
      data.edges.push({ _id: newId(), from: existing._id, to: captureId, type: "evidence", weight: 1 });
      existing.history.push({ day: data.day, event: "reinforced", note: `seen again in ${captureId}` });
      for (const state of data.beliefStates)
        if (state.belief_id === existing._id && (state.status === "active" || state.status === "cracked"))
          state.confidence = reinforce(state.confidence);
    }
    return { kind: "reinforced", belief_id: existing._id };
  }
  data.beliefs.push(candidate);
  data.edges.push({ _id: newId(), from: candidate._id, to: captureId, type: "evidence", weight: 1 });
  return { kind: "inserted", belief_id: candidate._id };
}
