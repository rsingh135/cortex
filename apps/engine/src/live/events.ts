/**
 * Translate Atlas change-stream events into palace WebSocket events (@cortex/schema/events).
 * Pure where possible; cases needing a lookup return `{ needs: ... }` for server.ts to resolve.
 * docs/spec.md > The palace > Rendering; docs/contracts.md > WebSocket.
 */
import { WsEvent, type Belief, type BeliefState, type Capture, type Procedure } from "@cortex/schema";

export interface ChangeEvent {
  operationType: "insert" | "update" | "replace" | "delete";
  ns: { coll: string };
  documentKey: { _id: string };
  fullDocument?: Record<string, unknown>;
  updateDescription?: { updatedFields?: Record<string, unknown>; removedFields?: string[] };
}

export interface Lookup {
  /** For image_levels deletes: the level doc is gone; the caller maps level `_id` → capture id + level from its cache. */
  levelIndex: (levelId: string) => { capture_id: string; level: "L0" | "L1" | "L2" | "L3"; bytes: number } | null;
  captureState: (captureId: string) => { ceiling: "L0" | "L1" | "L2" | "L3" | null } | null;
  beliefConfidence: (beliefId: string) => number;
}

export type Translation = { event: WsEvent } | { skip: string };

export function translate(change: ChangeEvent, ctx: { id: string; day: number; ts: string }, lookup: Lookup): Translation {
  const base = { id: ctx.id, day: ctx.day, ts: ctx.ts, condition: "cortex" as const };
  switch (change.ns.coll) {
    case "beliefs": {
      if (change.operationType !== "insert" || !change.fullDocument) return { skip: `beliefs.${change.operationType}` };
      const doc = change.fullDocument as Belief;
      const { embedding: _embedding, ...rest } = doc;
      void _embedding;
      return { event: WsEvent.parse({ ...base, type: "belief.created", payload: { ...rest, confidence: doc.c0 } }) };
    }
    case "belief_state": {
      const fields = change.updateDescription?.updatedFields ?? {};
      const full = change.fullDocument as BeliefState | undefined;
      const beliefId = full?.belief_id;
      if (!beliefId) return { skip: "belief_state without fullDocument" };
      if (fields["status"] === "superseded" && full?.superseded_by) {
        return { event: WsEvent.parse({ ...base, type: "belief.superseded", payload: { belief_id: beliefId, superseded_by: full.superseded_by } }) };
      }
      if (fields["status"] === "forgotten") return { skip: "belief.forgotten needs room; resolve in server" };
      if ("recalls" in fields) {
        return { event: WsEvent.parse({ ...base, type: "belief.recalled", payload: { belief_id: beliefId, confidence: full?.confidence ?? lookup.beliefConfidence(beliefId), recalls: full?.recalls ?? 0, reason: "recall" } }) };
      }
      return { skip: "belief_state decay (batched into clock.advanced)" };
    }
    case "captures": {
      if (change.operationType !== "insert" || !change.fullDocument) return { skip: `captures.${change.operationType}` };
      const { page_text: _pt, ...rest } = change.fullDocument as Capture;
      void _pt;
      return { event: WsEvent.parse({ ...base, type: "capture.created", payload: rest }) };
    }
    case "image_levels": {
      if (change.operationType !== "delete") return { skip: `image_levels.${change.operationType}` };
      const hit = lookup.levelIndex(change.documentKey._id);
      if (!hit) return { skip: "image_levels delete for unknown level id" };
      const state = lookup.captureState(hit.capture_id);
      return {
        event: WsEvent.parse({ ...base, type: "level.deleted", payload: { capture_id: hit.capture_id, levels: [hit.level], ceiling: state?.ceiling ?? null, bytes_freed: hit.bytes } }),
      };
    }
    case "procedures": {
      const doc = change.fullDocument as Procedure | undefined;
      if (change.operationType === "insert" && doc) {
        const { embedding: _e, ...rest } = doc;
        void _e;
        return { event: WsEvent.parse({ ...base, type: "procedure.created", payload: rest }) };
      }
      const status = change.updateDescription?.updatedFields?.["status"];
      if (status === "cracked" && doc) {
        return { event: WsEvent.parse({ ...base, type: "procedure.cracked", payload: { procedure_id: doc._id, by_belief_id: doc.cracked_by.at(-1) ?? "" } }) };
      }
      return { skip: `procedures.${change.operationType}` };
    }
    case "edges": {
      if (change.operationType !== "insert" || !change.fullDocument) return { skip: `edges.${change.operationType}` };
      return { event: WsEvent.parse({ ...base, type: "edge.created", payload: change.fullDocument }) };
    }
    case "voice_notes": {
      if (change.operationType !== "insert" || !change.fullDocument) return { skip: `voice_notes.${change.operationType}` };
      const doc = change.fullDocument as { _id: string; transcript: string };
      return { event: WsEvent.parse({ ...base, type: "voice.received", payload: { voice_note_id: doc._id, transcript: doc.transcript } }) };
    }
    default:
      return { skip: `collection ${change.ns.coll}` };
  }
}
