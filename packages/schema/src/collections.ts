import { z } from "zod";
import {
  Actor,
  ActionType,
  App,
  BeliefStatus,
  ClockMode,
  Condition,
  DecisionOutcome,
  EdgeType,
  Hunt,
  Kind,
  Level,
  ListingAttr,
  Predicate,
  ProcedureStatus,
  QuestionGroup,
  Room,
  Source,
} from "./enums";
import { Rule } from "./rules";

/** ULID string. Every `_id` in every collection. */
export const Id = z.string().min(1);
export type Id = z.infer<typeof Id>;

/** Simulated day, 1-based. */
export const Day = z.number().int().min(0);

/** BSON BinData as seen through the driver. Validated loosely here; the driver owns the type. */
export const BinData = z.unknown();

// ---------------------------------------------------------------------------
// Canonical memory documents (written once, shared by every condition)
// ---------------------------------------------------------------------------

export const CaptureAction = z.object({
  type: ActionType,
  text: z.string().optional(),
  /** [x, y, w, h] in viewport pixels. */
  bbox: z.tuple([z.number(), z.number(), z.number(), z.number()]).optional(),
});

/** One per screenshot event. `page_text` is deleted once extraction succeeds. */
export const Capture = z.object({
  _id: Id,
  episode_id: Id,
  day: Day,
  ts: z.string().datetime(),
  actor: Actor,
  app: App,
  url: z.string(),
  title: z.string(),
  action: CaptureAction,
  /** Attributes supplied by the capture client; retained until decision parsing/extraction. */
  listing: z.object({
    listing_id: z.string(),
    attrs: z.record(z.string(), z.union([z.number(), z.string(), z.boolean()])),
  }).optional(),
  page_text: z.string().optional(),
  phash: z.string(),
  /** Set when extraction has run; the beliefs it produced. */
  extracted: z.boolean(),
  belief_ids: z.array(Id),
  /** Original L0 byte size, kept so keep-everything accounting survives level deletion. */
  l0_bytes: z.number().int().nonnegative(),
});
export type Capture = z.infer<typeof Capture>;

/** One document per rung. Deleting a rung is deleting a document. */
export const ImageLevel = z.object({
  _id: Id,
  capture_id: Id,
  level: Level,
  width: z.number().int().positive(),
  height: z.number().int().positive(),
  bytes: z.number().int().nonnegative(),
  /** WebP q80 for every level in every condition. */
  data: BinData,
  /** Set only in realtime mode; TTL index deletes the doc. */
  expires_at: z.string().datetime().optional(),
});
export type ImageLevel = z.infer<typeof ImageLevel>;

export const Triple = z.object({
  s: z.string(),
  p: Predicate,
  o: z.string(),
});
export type Triple = z.infer<typeof Triple>;

export const Belief = z.object({
  _id: Id,
  triple: Triple,
  text: z.string(),
  kind: Kind,
  room: Room,
  source: Source,
  inferred: z.boolean(),
  pinned: z.boolean(),
  /** Initial confidence at creation; live confidence lives in belief_state. */
  c0: z.number().min(0).max(1),
  evidence: z.array(Id),
  /** Rule attached when kind = preference and source = learner. */
  rule: Rule.optional(),
  /** int8 BinData, 512 dims (voyage-3-lite). Excluded from byte accounting. */
  embedding: BinData.optional(),
  trace_url: z.string().url().optional(),
  created_day: Day,
  history: z.array(
    z.object({
      day: Day,
      event: z.string(),
      note: z.string().optional(),
    }),
  ),
});
export type Belief = z.infer<typeof Belief>;

export const Edge = z.object({
  _id: Id,
  from: Id,
  to: Id,
  type: EdgeType,
  weight: z.number().min(0).max(1),
});
export type Edge = z.infer<typeof Edge>;

export const ProcedureStep = z.object({
  n: z.number().int().positive(),
  do: z.string(),
  args: z.record(z.string(), z.unknown()).optional(),
  /** Belief ids whose rules this step applies. */
  uses: z.array(Id).optional(),
});

export const Procedure = z.object({
  _id: Id,
  name: z.string(),
  description: z.string(),
  room: Room,
  status: ProcedureStatus,
  steps: z.array(ProcedureStep),
  /** Attributes the decide step reasons over. New preferences on these attrs crack the procedure. */
  decision_attributes: z.array(ListingAttr),
  learned_from: z.array(Id),
  /** Style belief used to draft messages. */
  style_belief_id: Id.optional(),
  runs: z.number().int().nonnegative(),
  last_run_day: Day.optional(),
  cracked_by: z.array(Id),
  embedding: BinData.optional(),
});
export type Procedure = z.infer<typeof Procedure>;

export const ListingAttrs = z.object({
  price: z.number().int().nonnegative(),
  neighborhood: z.string(),
  train: z.string(),
  floor: z.number().int(),
  elevator: z.boolean(),
  laundry: z.boolean(),
  pets: z.boolean(),
  /** Derived: floor when no elevator, else 0. See LISTING_ATTRS. */
  walkup_floor: z.number().int().nonnegative(),
});
export type ListingAttrs = z.infer<typeof ListingAttrs>;

/** Compute the derived attribute from the raw ones. */
export function walkupFloor(floor: number, elevator: boolean): number {
  return elevator ? 0 : Math.max(0, floor);
}

/** One decision Maya (or the agent) made about one listing in one episode. Attrs parsed from captures. */
export const Decision = z.object({
  _id: Id,
  episode_id: Id,
  actor: Actor,
  listing_id: z.string(),
  attrs: ListingAttrs,
  outcome: DecisionOutcome,
  capture_ids: z.array(Id),
  /** Rule belief ids cited (agent decisions only). */
  because: z.array(Id).optional(),
});
export type Decision = z.infer<typeof Decision>;

export const Episode = z.object({
  _id: Id,
  day: Day,
  actor: Actor,
  app: App,
  started_at: z.string().datetime(),
  ended_at: z.string().datetime().optional(),
  summary: z.string().optional(),
  summary_belief_id: Id.optional(),
  workflow: z.string().optional(),
  capture_count: z.number().int().nonnegative(),
});
export type Episode = z.infer<typeof Episode>;

export const Recall = z.object({
  _id: Id,
  condition: Condition,
  target_type: z.enum(["belief", "capture", "procedure"]),
  target_id: Id,
  day: Day,
  by: z.enum(["agent", "maya", "usage_log", "eval"]),
  reason: z.string(),
  /** Cascaded from a belief recall to its evidence. */
  cascaded_from: Id.optional(),
  dry_run: z.boolean(),
});
export type Recall = z.infer<typeof Recall>;

export const VoiceNote = z.object({
  _id: Id,
  day: Day,
  transcript: z.string(),
  belief_ids: z.array(Id),
  cracked_procedure_ids: z.array(Id),
});
export type VoiceNote = z.infer<typeof VoiceNote>;

export const Clock = z.object({
  _id: z.literal("clock"),
  day: Day,
  mode: ClockMode,
});
export type Clock = z.infer<typeof Clock>;

// ---------------------------------------------------------------------------
// Per-condition state ledgers
// ---------------------------------------------------------------------------

/** What one condition currently holds for one capture. Bytes for that condition = sum of alive level bytes. */
export const CaptureState = z.object({
  _id: Id,
  condition: Condition,
  capture_id: Id,
  alive_levels: z.array(Level),
  /** Sharpest alive level, or null when every level is gone ("forgotten" frame). */
  ceiling: Level.nullable(),
  clarity: z.number().min(0).max(1),
  recalls: z.number().int().nonnegative(),
  last_recall_day: Day,
});
export type CaptureState = z.infer<typeof CaptureState>;

export const BeliefState = z.object({
  _id: Id,
  condition: Condition,
  belief_id: Id,
  confidence: z.number().min(0).max(1),
  recalls: z.number().int().nonnegative(),
  last_recall_day: Day,
  status: BeliefStatus,
  superseded_by: Id.nullable(),
});
export type BeliefState = z.infer<typeof BeliefState>;

/** Daily byte + accuracy ledger row per condition; feeds the chart. */
export const DailyStat = z.object({
  _id: Id,
  condition: Condition,
  day: Day,
  image_bytes: z.number().int().nonnegative(),
  belief_bytes: z.number().int().nonnegative(),
  captures_alive: z.number().int().nonnegative(),
  captures_forgotten: z.number().int().nonnegative(),
  beliefs_active: z.number().int().nonnegative(),
  /** Set only on checkpoint days. */
  accuracy: z
    .object({
      weighted: z.number().min(0).max(1),
      by_group: z.record(QuestionGroup, z.number().min(0).max(1)),
      tokens_per_answer: z.number().nonnegative(),
    })
    .optional(),
});
export type DailyStat = z.infer<typeof DailyStat>;

// ---------------------------------------------------------------------------
// Mock world
// ---------------------------------------------------------------------------

export const Listing = z.object({
  _id: z.string(),
  hunt: Hunt,
  title: z.string(),
  ...ListingAttrs.shape,
  photos: z.array(z.string()),
  landlord: z.string(),
  description: z.string(),
  /** Which trap this listing is, if any. */
  trap: z.enum(["walkup", "no_laundry", "over_budget", "off_l", "no_pets"]).optional(),
  /** Id of the contrastive twin, if any. */
  pair_with: z.string().optional(),
});
export type Listing = z.infer<typeof Listing>;

export const Message = z.object({
  _id: Id,
  thread_id: z.string(),
  kind: z.enum(["inbox", "landlord_chat"]),
  listing_id: z.string().optional(),
  from: z.string(),
  to: z.string(),
  subject: z.string().optional(),
  body: z.string(),
  day: Day,
  sent_by: Actor.or(z.literal("world")),
});
export type Message = z.infer<typeof Message>;

export const CalendarEvent = z.object({
  _id: Id,
  title: z.string(),
  day: Day,
  start: z.string(),
  end: z.string(),
  location: z.string().optional(),
  attendees: z.array(z.string()),
});
export type CalendarEvent = z.infer<typeof CalendarEvent>;

// ---------------------------------------------------------------------------
// Persona and evaluation fixtures (packages/persona/data)
// ---------------------------------------------------------------------------

export const Question = z.object({
  id: z.string(),
  group: QuestionGroup,
  question: z.string(),
  answer: z.string(),
  /** Exact match or model judge. */
  grading: z.enum(["exact", "judge"]),
  /** For seen_once questions: the capture that holds the answer and the coarsest level it survives at. */
  evidence_capture_hint: z.string().optional(),
  survives_at: Level.optional(),
});
export type Question = z.infer<typeof Question>;

export const UsageLogEntry = z.object({
  day: Day,
  kind: z.enum(["question", "task"]),
  text: z.string(),
  /** Rooms the recall should touch; used by the simulator and the eval replay. */
  rooms: z.array(Room),
});
export type UsageLogEntry = z.infer<typeof UsageLogEntry>;

export const GroundTruthRule = z.object({
  attr: ListingAttr,
  op: z.enum(["<=", ">=", "==", "!=", "in"]),
  value: z.union([z.number(), z.string(), z.boolean(), z.array(z.string())]),
  active_from_day: Day,
});

export const GroundTruth = z.object({
  rules: z.array(GroundTruthRule),
  style: z.string(),
  questions: z.array(Question),
});
export type GroundTruth = z.infer<typeof GroundTruth>;

export const COLLECTION_NAMES = [
  "captures",
  "image_levels",
  "beliefs",
  "edges",
  "procedures",
  "decisions",
  "episodes",
  "recalls",
  "voice_notes",
  "clock",
  "capture_state",
  "belief_state",
  "daily_stats",
  "listings",
  "messages",
  "calendar_events",
] as const;
export type CollectionName = (typeof COLLECTION_NAMES)[number];
