/**
 * Converters from engine documents (as they arrive in WsEvent payloads) to the palace view model.
 */
import { DEFAULT_PARAMS, LEVELS, describeRule, type WsEvent } from "@cortex/schema";
import { snapshotBytes } from "./bytes";
import type { PalaceBelief, PalaceCapture, PalaceProcedure, PalaceSnapshot } from "./types";

type SnapshotEvent = Extract<WsEvent, { type: "snapshot" }>;
type SnapshotBelief = SnapshotEvent["payload"]["beliefs"][number];
type SnapshotCapture = SnapshotEvent["payload"]["captures"][number];
type SnapshotProcedure = SnapshotEvent["payload"]["procedures"][number];
type CreatedBelief = Extract<WsEvent, { type: "belief.created" }>["payload"];
type CreatedCapture = Extract<WsEvent, { type: "capture.created" }>["payload"];

/** Where a live capture's image is served from. */
export type TextureResolver = (capture: Pick<PalaceCapture, "id" | "app" | "title" | "ceiling">) => string | null;

function isBeliefStatus(s: string): s is PalaceBelief["status"] {
  return s === "active" || s === "cracked" || s === "superseded" || s === "tombstoned" || s === "forgotten";
}

export function beliefFromDoc(doc: SnapshotBelief | CreatedBelief, day: number): PalaceBelief {
  const status = "status" in doc && typeof doc.status === "string" && isBeliefStatus(doc.status) ? doc.status : "active";
  return {
    id: doc._id,
    text: doc.text,
    kind: doc.kind,
    room: doc.room,
    source: doc.source,
    inferred: doc.inferred,
    pinned: doc.pinned,
    status,
    confidence: doc.confidence,
    recalls: 0,
    evidence: [...doc.evidence],
    createdDay: doc.created_day,
    history: doc.history.map((h) => ({ day: h.day, event: h.event, note: h.note })),
    ruleText: doc.rule ? describeRule(doc.rule) : undefined,
    c0: doc.c0,
    recallDays: [],
    lastRecallDay: Math.max(doc.created_day, Math.min(day, doc.created_day)),
    supersededBy: null,
  };
}

export function captureFromDoc(doc: SnapshotCapture | CreatedCapture, day: number, texture: TextureResolver): PalaceCapture {
  const alive = "alive_levels" in doc ? [...doc.alive_levels] : [...LEVELS];
  const ceiling = "ceiling" in doc ? doc.ceiling : "L0";
  const clarity = "clarity" in doc ? doc.clarity : DEFAULT_PARAMS.levelValue.L0;
  const base: PalaceCapture = {
    id: doc._id,
    app: doc.app,
    title: doc.title,
    day: doc.day,
    aliveLevels: alive,
    ceiling,
    clarity,
    recalls: 0,
    textureUrl: null,
    recallDays: [],
    lastRecallDay: Math.min(day, doc.day),
    l0Bytes: doc.l0_bytes,
    url: doc.url,
  };
  return { ...base, textureUrl: ceiling === null ? null : texture(base) };
}

export function procedureFromDoc(doc: SnapshotProcedure): PalaceProcedure {
  return {
    id: doc._id,
    name: doc.name,
    description: doc.description,
    room: doc.room,
    status: doc.status,
    steps: doc.steps.map((s) => ({ n: s.n, do: s.do, uses: [...(s.uses ?? [])] })),
    crackedBy: [...doc.cracked_by],
  };
}

export function snapshotFromEvent(e: SnapshotEvent, texture: TextureResolver): PalaceSnapshot {
  const captures = e.payload.captures.map((c) => captureFromDoc(c, e.day, texture));
  return {
    day: e.day,
    beliefs: e.payload.beliefs.map((b) => beliefFromDoc(b, e.day)),
    captures,
    procedures: e.payload.procedures.map(procedureFromDoc),
    edges: e.payload.edges.map((edge) => ({ id: edge._id, from: edge.from, to: edge.to, type: edge.type })),
    bytes: snapshotBytes(captures, e.day),
  };
}

