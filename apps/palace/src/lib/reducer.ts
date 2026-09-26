/**
 * The single reducer for every live and fixture event. Pure: (snapshot, event) -> snapshot plus
 * what the scene needs to animate (which ids pulse, whether placements must be recomputed).
 * Exhaustive over WsEventType; the `never` check in the default arm keeps it that way.
 */
import { DEFAULT_PARAMS, type WsEvent } from "@cortex/schema";
import { beliefFromDoc, captureFromDoc, procedureFromDoc, snapshotFromEvent, type TextureResolver } from "./adapt";
import { snapshotBytes } from "./bytes";
import type { PalaceBelief, PalaceCapture, PalaceSnapshot } from "./types";

export interface ReduceResult {
  snapshot: PalaceSnapshot;
  /** Ids whose objects should pulse (recall/reinforce). */
  pulses: string[];
  /** Placement-relevant membership changed; recompute the layout. */
  membershipChanged: boolean;
}

export function reduceSnapshot(snapshot: PalaceSnapshot, e: WsEvent, texture: TextureResolver): ReduceResult {
  switch (e.type) {
    case "capture.created": {
      const created = captureFromDoc(e.payload, e.day, texture);
      const captures = [...snapshot.captures.filter((c) => c.id !== created.id), created];
      return { snapshot: { ...snapshot, captures, bytes: snapshotBytes(captures, snapshot.day) }, pulses: [], membershipChanged: true };
    }
    case "capture.recalled": {
      const captures = mapCapture(snapshot, e.payload.capture_id, (c) => ({
        ...c,
        clarity: e.payload.clarity,
        ceiling: e.payload.ceiling,
        recalls: e.payload.recalls,
        recallDays: c.recallDays.includes(e.day) ? c.recallDays : [...c.recallDays, e.day],
        lastRecallDay: e.day,
        textureUrl: e.payload.ceiling === null ? null : (c.textureUrl ?? texture({ ...c, ceiling: e.payload.ceiling })),
      }));
      return { snapshot: { ...snapshot, captures }, pulses: [e.payload.capture_id], membershipChanged: false };
    }
    case "level.deleted": {
      const captures = mapCapture(snapshot, e.payload.capture_id, (c) => {
        const aliveLevels = c.aliveLevels.filter((lvl) => !e.payload.levels.includes(lvl));
        const ceiling = e.payload.ceiling;
        const next = { ...c, aliveLevels, ceiling, clarity: ceiling === null ? 0 : Math.min(c.clarity, DEFAULT_PARAMS.levelValue[ceiling]) };
        return { ...next, textureUrl: ceiling === null ? null : ceiling !== c.ceiling ? texture(next) : c.textureUrl };
      });
      return { snapshot: { ...snapshot, captures, bytes: snapshotBytes(captures, snapshot.day) }, pulses: [], membershipChanged: false };
    }
    case "belief.created": {
      const created = beliefFromDoc(e.payload, e.day);
      const beliefs = [...snapshot.beliefs.filter((b) => b.id !== created.id), created];
      return { snapshot: { ...snapshot, beliefs }, pulses: [created.id], membershipChanged: true };
    }
    case "belief.reinforced": {
      const beliefs = mapBelief(snapshot, e.payload.belief_id, (b) => ({
        ...b,
        confidence: e.payload.confidence,
        evidence: [...b.evidence, ...e.payload.evidence_added.filter((id) => !b.evidence.includes(id))],
        history: [...b.history, { day: e.day, event: "reinforced" }],
      }));
      return { snapshot: { ...snapshot, beliefs }, pulses: [e.payload.belief_id], membershipChanged: e.payload.evidence_added.length > 0 };
    }
    case "belief.recalled": {
      const beliefs = mapBelief(snapshot, e.payload.belief_id, (b) => ({
        ...b,
        confidence: e.payload.confidence,
        recalls: e.payload.recalls,
        recallDays: b.recallDays.includes(e.day) ? b.recallDays : [...b.recallDays, e.day],
        lastRecallDay: e.day,
      }));
      return { snapshot: { ...snapshot, beliefs }, pulses: [e.payload.belief_id], membershipChanged: false };
    }
    case "belief.updated": {
      const beliefs = mapBelief(snapshot, e.payload.belief_id, (b) => ({
        ...b,
        text: e.payload.text,
        confidence: e.payload.confidence,
        c0: e.payload.by === "sweep" ? b.c0 : e.payload.confidence,
        source: e.payload.by === "maya" ? "manual" : b.source,
        history: [...b.history, { day: e.day, event: "updated", note: `by ${e.payload.by}` }],
      }));
      return { snapshot: { ...snapshot, beliefs }, pulses: [e.payload.belief_id], membershipChanged: false };
    }
    case "belief.superseded": {
      const beliefs = mapBelief(snapshot, e.payload.belief_id, (b) => ({
        ...b,
        status: "superseded",
        supersededBy: e.payload.superseded_by,
        history: [...b.history, { day: e.day, event: "superseded", note: `by ${e.payload.superseded_by}` }],
      }));
      return { snapshot: { ...snapshot, beliefs }, pulses: [e.payload.superseded_by], membershipChanged: true };
    }
    case "belief.tombstoned": {
      const deleted = new Set(e.payload.captures_deleted);
      const beliefs = mapBelief(snapshot, e.payload.belief_id, (b) => ({ ...b, status: "tombstoned", history: [...b.history, { day: e.day, event: "tombstoned" }] }));
      const captures = snapshot.captures.filter((c) => !deleted.has(c.id));
      return { snapshot: { ...snapshot, beliefs, captures, bytes: snapshotBytes(captures, snapshot.day) }, pulses: [], membershipChanged: true };
    }
    case "belief.forgotten": {
      const beliefs = mapBelief(snapshot, e.payload.belief_id, (b) => ({ ...b, status: "forgotten", history: [...b.history, { day: e.day, event: "forgotten" }] }));
      return { snapshot: { ...snapshot, beliefs }, pulses: [], membershipChanged: true };
    }
    case "edge.created": {
      if (snapshot.edges.some((edge) => edge.id === e.payload._id)) return { snapshot, pulses: [], membershipChanged: false };
      const edges = [...snapshot.edges, { id: e.payload._id, from: e.payload.from, to: e.payload.to, type: e.payload.type }];
      return { snapshot: { ...snapshot, edges }, pulses: [], membershipChanged: e.payload.type === "evidence" };
    }
    case "procedure.created": {
      const created = procedureFromDoc(e.payload);
      const procedures = [...snapshot.procedures.filter((p) => p.id !== created.id), created];
      return { snapshot: { ...snapshot, procedures }, pulses: [created.id], membershipChanged: true };
    }
    case "procedure.cracked": {
      const procedures = snapshot.procedures.map((p) =>
        p.id === e.payload.procedure_id ? { ...p, status: "cracked" as const, crackedBy: p.crackedBy.includes(e.payload.by_belief_id) ? p.crackedBy : [...p.crackedBy, e.payload.by_belief_id] } : p,
      );
      return { snapshot: { ...snapshot, procedures }, pulses: [e.payload.by_belief_id], membershipChanged: false };
    }
    case "procedure.healed": {
      const procedures = snapshot.procedures.map((p) => (p.id === e.payload.procedure_id ? { ...p, status: "active" as const, crackedBy: [] } : p));
      return { snapshot: { ...snapshot, procedures }, pulses: [e.payload.procedure_id], membershipChanged: false };
    }
    case "procedure.step":
      return { snapshot, pulses: [e.payload.procedure_id, ...e.payload.because], membershipChanged: false };
    case "clock.advanced": {
      const day = e.payload.to_day;
      return { snapshot: { ...snapshot, day, bytes: snapshotBytes(snapshot.captures, day) }, pulses: [], membershipChanged: day !== snapshot.day };
    }
    case "voice.received":
      return { snapshot, pulses: [], membershipChanged: false };
    case "snapshot":
      return { snapshot: snapshotFromEvent(e, texture), pulses: [], membershipChanged: true };
    default: {
      const unknown: never = e;
      console.warn("palace: unknown event type", (unknown as { type?: string }).type);
      return { snapshot, pulses: [], membershipChanged: false };
    }
  }
}

function mapCapture(snapshot: PalaceSnapshot, id: string, fn: (c: PalaceCapture) => PalaceCapture): PalaceCapture[] {
  return snapshot.captures.map((c) => (c.id === id ? fn(c) : c));
}

function mapBelief(snapshot: PalaceSnapshot, id: string, fn: (b: PalaceBelief) => PalaceBelief): PalaceBelief[] {
  return snapshot.beliefs.map((b) => (b.id === id ? fn(b) : b));
}
