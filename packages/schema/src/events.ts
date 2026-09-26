/**
 * WebSocket envelope the engine pushes to the palace. One envelope per Atlas change, coalesced
 * per capture during sweeps. Also the shape of the stored event log used by replay mode.
 */
import { z } from "zod";
import { Condition, Level, Room, WsEventType } from "./enums.js";
import { Belief, Capture, Edge, Procedure } from "./collections.js";

const base = {
  /** ULID of the event itself. */
  id: z.string(),
  day: z.number().int().min(0),
  ts: z.string().datetime(),
  /** Which condition's state changed. The palace shows `cortex`. */
  condition: Condition.default("cortex"),
};

export const CaptureCreated = z.object({ ...base, type: z.literal("capture.created"), payload: Capture.omit({ page_text: true }) });
export const CaptureRecalled = z.object({
  ...base,
  type: z.literal("capture.recalled"),
  payload: z.object({ capture_id: z.string(), clarity: z.number(), ceiling: Level.nullable(), recalls: z.number().int(), cascaded_from: z.string().optional() }),
});
export const LevelDeleted = z.object({
  ...base,
  type: z.literal("level.deleted"),
  payload: z.object({ capture_id: z.string(), levels: z.array(Level), ceiling: Level.nullable(), bytes_freed: z.number().int() }),
});
export const BeliefCreated = z.object({ ...base, type: z.literal("belief.created"), payload: Belief.omit({ embedding: true }).extend({ confidence: z.number() }) });
export const BeliefReinforced = z.object({ ...base, type: z.literal("belief.reinforced"), payload: z.object({ belief_id: z.string(), confidence: z.number(), evidence_added: z.array(z.string()) }) });
export const BeliefRecalled = z.object({ ...base, type: z.literal("belief.recalled"), payload: z.object({ belief_id: z.string(), confidence: z.number(), recalls: z.number().int(), reason: z.string() }) });
export const BeliefUpdated = z.object({ ...base, type: z.literal("belief.updated"), payload: z.object({ belief_id: z.string(), text: z.string(), confidence: z.number(), by: z.enum(["maya", "agent", "sweep"]) }) });
export const BeliefSuperseded = z.object({ ...base, type: z.literal("belief.superseded"), payload: z.object({ belief_id: z.string(), superseded_by: z.string() }) });
export const BeliefTombstoned = z.object({ ...base, type: z.literal("belief.tombstoned"), payload: z.object({ belief_id: z.string(), captures_deleted: z.array(z.string()) }) });
export const BeliefForgotten = z.object({ ...base, type: z.literal("belief.forgotten"), payload: z.object({ belief_id: z.string(), room: Room }) });
export const EdgeCreated = z.object({ ...base, type: z.literal("edge.created"), payload: Edge });
export const ProcedureCreated = z.object({ ...base, type: z.literal("procedure.created"), payload: Procedure.omit({ embedding: true }) });
export const ProcedureCracked = z.object({ ...base, type: z.literal("procedure.cracked"), payload: z.object({ procedure_id: z.string(), by_belief_id: z.string(), attr: z.string().optional() }) });
export const ProcedureHealed = z.object({ ...base, type: z.literal("procedure.healed"), payload: z.object({ procedure_id: z.string(), run_id: z.string() }) });
export const ProcedureStepEvent = z.object({
  ...base,
  type: z.literal("procedure.step"),
  payload: z.object({ procedure_id: z.string(), run_id: z.string(), step: z.number().int(), do: z.string(), listing_id: z.string().optional(), because: z.array(z.string()).default([]) }),
});
export const ClockAdvanced = z.object({
  ...base,
  type: z.literal("clock.advanced"),
  payload: z.object({
    from_day: z.number().int(),
    to_day: z.number().int(),
    levels_deleted: z.number().int(),
    bytes_freed: z.number().int(),
    captures_forgotten: z.number().int(),
    beliefs_decayed: z.number().int(),
    beliefs_forgotten: z.number().int(),
    rooms_dimmed: z.array(Room),
  }),
});
export const VoiceReceived = z.object({ ...base, type: z.literal("voice.received"), payload: z.object({ voice_note_id: z.string(), transcript: z.string() }) });
export const Snapshot = z.object({
  ...base,
  type: z.literal("snapshot"),
  payload: z.object({
    beliefs: z.array(Belief.omit({ embedding: true }).extend({ confidence: z.number(), status: z.string() })),
    captures: z.array(Capture.omit({ page_text: true }).extend({ alive_levels: z.array(Level), ceiling: Level.nullable(), clarity: z.number() })),
    procedures: z.array(Procedure.omit({ embedding: true })),
    edges: z.array(Edge),
  }),
});

export const WsEvent = z.discriminatedUnion("type", [
  CaptureCreated,
  CaptureRecalled,
  LevelDeleted,
  BeliefCreated,
  BeliefReinforced,
  BeliefRecalled,
  BeliefUpdated,
  BeliefSuperseded,
  BeliefTombstoned,
  BeliefForgotten,
  EdgeCreated,
  ProcedureCreated,
  ProcedureCracked,
  ProcedureHealed,
  ProcedureStepEvent,
  ClockAdvanced,
  VoiceReceived,
  Snapshot,
]);
export type WsEvent = z.infer<typeof WsEvent>;

/** Compile-time check that every enum member has an envelope. */
const _covered: Record<WsEventType, true> = {
  "capture.created": true,
  "capture.recalled": true,
  "level.deleted": true,
  "belief.created": true,
  "belief.reinforced": true,
  "belief.recalled": true,
  "belief.updated": true,
  "belief.superseded": true,
  "belief.tombstoned": true,
  "belief.forgotten": true,
  "edge.created": true,
  "procedure.created": true,
  "procedure.cracked": true,
  "procedure.healed": true,
  "procedure.step": true,
  "clock.advanced": true,
  "voice.received": true,
  snapshot: true,
};
void _covered;
