/**
 * Writes an extraction result into the ledger. Pure over MemoryData so it runs inside one
 * store transaction and is testable without a model.
 */
import { CONDITIONS, DEFAULT_PARAMS, type Belief, type Capture } from "@cortex/schema";
import type { MemoryData } from "../db/memory-data.js";
import { consolidateExact } from "../consolidation/index.js";
import { newId } from "../lib/ids.js";
import type { ExtractionOutput } from "./schema.js";

export interface ApplyResult {
  capture_id: string;
  inserted: string[];
  reinforced: string[];
}

/** Descriptions of the previous captures in the same episode, newest last, for extraction context. */
export function previousCaptures(data: MemoryData, capture: Capture, count = 3): string[] {
  return data.captures
    .filter((c) => c.episode_id === capture.episode_id && c.ts < capture.ts)
    .sort((a, b) => (a.ts < b.ts ? -1 : 1))
    .slice(-count)
    .map((c) => `${c.action.type}${c.action.text ? ` "${c.action.text}"` : ""} on ${c.title} (${c.url})`);
}

export function applyExtraction(data: MemoryData, captureId: string, output: ExtractionOutput): ApplyResult {
  const capture = data.captures.find((c) => c._id === captureId);
  if (!capture) throw new RangeError(`Unknown capture ${captureId}`);
  const inserted: string[] = [];
  const reinforced: string[] = [];
  for (const extracted of output.beliefs) {
    const candidate: Belief = {
      _id: newId(),
      triple: { s: extracted.s.trim(), p: extracted.p, o: extracted.o.trim() },
      text: extracted.text.trim(),
      kind: extracted.kind,
      room: extracted.room,
      source: "screen",
      inferred: false,
      pinned: false,
      c0: DEFAULT_PARAMS.c0.screenEvent,
      evidence: [captureId],
      created_day: capture.day,
      history: [{ day: data.day, event: "created", note: "extracted from screenshot" }],
    };
    if (!candidate.text || !candidate.triple.s || !candidate.triple.o) continue;
    const outcome = consolidateExact(data, candidate, captureId);
    if (outcome.kind === "inserted") {
      inserted.push(outcome.belief_id);
      for (const condition of CONDITIONS)
        data.beliefStates.push({
          _id: newId(),
          condition,
          belief_id: outcome.belief_id,
          confidence: candidate.c0,
          recalls: 0,
          last_recall_day: data.day,
          status: "active",
          superseded_by: null,
        });
    } else reinforced.push(outcome.belief_id);
    if (!capture.belief_ids.includes(outcome.belief_id)) capture.belief_ids.push(outcome.belief_id);
  }
  if (output.listing && !capture.listing) {
    const { listing_id, ...attrs } = output.listing;
    capture.listing = { listing_id, attrs: { ...attrs, walkup_floor: attrs.elevator ? 0 : Math.max(0, attrs.floor) } };
  }
  capture.extracted = true;
  delete capture.page_text;
  return { capture_id: captureId, inserted, reinforced };
}
