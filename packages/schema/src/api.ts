/**
 * HTTP contracts for apps/engine. Request and response bodies; documented in docs/contracts.md.
 */
import { z } from "zod";
import { Actor, ActionType, App, Condition, Level, RequestRoute, Room } from "./enums.js";
import { Belief, Procedure } from "./collections.js";
import { Rule } from "./rules.js";

// POST /ingest/capture  (multipart: `image` = PNG/WebP, `meta` = JSON of IngestCaptureMeta)
export const IngestCaptureMeta = z.object({
  episode_id: z.string(),
  day: z.number().int().min(0),
  actor: Actor,
  app: App,
  url: z.string(),
  title: z.string(),
  action: z.object({
    type: ActionType,
    text: z.string().optional(),
    bbox: z.tuple([z.number(), z.number(), z.number(), z.number()]).optional(),
  }),
  page_text: z.string().optional(),
  /** Parsed listing attributes when the page is a listing; drives decisions. */
  listing: z
    .object({
      listing_id: z.string(),
      attrs: z.record(z.string(), z.union([z.number(), z.string(), z.boolean()])),
    })
    .optional(),
});
export type IngestCaptureMeta = z.infer<typeof IngestCaptureMeta>;

export const IngestCaptureResponse = z.object({
  capture_id: z.string(),
  /** False when the perceptual hash matched the previous frame and nothing was stored. */
  stored: z.boolean(),
  phash: z.string(),
});

// POST /episodes  and  POST /episodes/:id/end
export const StartEpisodeRequest = z.object({ day: z.number().int().min(0), actor: Actor, app: App });
export const StartEpisodeResponse = z.object({ episode_id: z.string() });
export const EndEpisodeResponse = z.object({ episode_id: z.string(), summary: z.string(), summary_belief_id: z.string().optional(), workflow_candidate: z.string().optional() });

// POST /clock/advance
export const AdvanceClockRequest = z.object({
  to_day: z.number().int().min(0),
  /** Run the forgetting sweep for these conditions; default all. */
  conditions: z.array(Condition).optional(),
});
export const AdvanceClockResponse = z.object({
  from_day: z.number().int(),
  to_day: z.number().int(),
  per_condition: z.record(
    Condition,
    z.object({
      levels_deleted: z.number().int(),
      bytes_freed: z.number().int(),
      captures_forgotten: z.number().int(),
      beliefs_decayed: z.number().int(),
      beliefs_forgotten: z.number().int(),
      rooms_dimmed: z.array(Room),
      image_bytes: z.number().int(),
      belief_bytes: z.number().int(),
    }),
  ),
});

// POST /recall
export const RecallRequest = z.object({
  query: z.string(),
  condition: Condition.default("cortex"),
  rooms: z.array(Room).optional(),
  by: z.enum(["agent", "maya", "usage_log", "eval"]),
  reason: z.string(),
  /** True for evaluation checkpoints: no log, no clock reset, no clarity restore. */
  dry_run: z.boolean().default(false),
  limit: z.number().int().min(1).max(50).default(10),
  /** Return evidence images at their current clarity. */
  with_images: z.boolean().default(false),
});
export type RecallRequest = z.infer<typeof RecallRequest>;

export const RecalledBelief = Belief.omit({ embedding: true }).extend({
  confidence: z.number(),
  score: z.number(),
  evidence_images: z
    .array(
      z.object({
        capture_id: z.string(),
        served_level: Level.nullable(),
        clarity: z.number(),
        /** Path the client fetches: GET /image/:capture_id?condition=... */
        url: z.string(),
      }),
    )
    .optional(),
});
export const RecallResponse = z.object({
  beliefs: z.array(RecalledBelief),
  procedures: z.array(Procedure.omit({ embedding: true })),
  recalled_ids: z.array(z.string()),
});

// GET /image/:capture_id?condition=cortex  -> image/webp at served level, or 404 when forgotten

// POST /learn
export const LearnRequest = z.object({ episode_ids: z.array(z.string()).min(2) });
export const LearnResponse = z.object({
  procedure: Procedure.omit({ embedding: true }),
  rules: z.array(z.object({ rule: Rule, belief_id: z.string(), explained: z.number().int(), pairs: z.number().int(), confidence: z.number() })),
  dropped: z.array(z.object({ rule: Rule, contradictions: z.array(z.string()) })),
  style_belief_id: z.string(),
});

// POST /voice  (transcript already produced by ElevenLabs on the client, or `audio` multipart)
export const VoiceRequest = z.object({ transcript: z.string().min(1), day: z.number().int().min(0).optional() });
export const VoiceResponse = z.object({
  voice_note_id: z.string(),
  beliefs: z.array(Belief.omit({ embedding: true }).extend({ confidence: z.number() })),
  superseded: z.array(z.string()),
  tombstoned: z.array(z.string()),
  cracked_procedures: z.array(z.string()),
});

// POST /route
export const RouteRequest = z.object({ text: z.string() });
export const RouteResponse = z.object({ route: RequestRoute, procedure_id: z.string().optional() });

// POST /agent/run
export const AgentRunRequest = z.object({ text: z.string(), procedure_id: z.string().optional(), day: z.number().int().optional() });
export const AgentRunResponse = z.object({
  run_id: z.string(),
  decisions: z.array(z.object({ listing_id: z.string(), outcome: z.enum(["skip", "message"]), because: z.array(z.string()) })),
  drafts: z.array(z.object({ listing_id: z.string(), text: z.string(), draft_id: z.string() })),
});

// POST /agent/drafts/:draft_id/approve
export const ApproveDraftResponse = z.object({ message_id: z.string(), sent: z.boolean() });

// POST /ask  (mascot and palace chat: routes, recalls, answers with citations; engine owns the Claude call)
export const AskRequest = z.object({
  text: z.string().min(1),
  /** Who is asking; drives voice/persona and recall logging. */
  client: z.enum(["mascot", "palace", "eval"]).default("mascot"),
  condition: Condition.default("cortex"),
  /** Evaluation checkpoints set true: recall without touching memory. */
  dry_run: z.boolean().default(false),
  /** Return an ElevenLabs audio URL for the answer. */
  speak: z.boolean().default(false),
});
export type AskRequest = z.infer<typeof AskRequest>;

export const AskResponse = z.object({
  route: RequestRoute,
  answer: z.string(),
  /** Belief ids the answer relied on; the palace pulses these. */
  cited: z.array(z.string()),
  recalled_ids: z.array(z.string()),
  /** Set when a workflow route started an agent run. */
  run_id: z.string().optional(),
  audio_url: z.string().optional(),
  trace_url: z.string().optional(),
});
export type AskResponse = z.infer<typeof AskResponse>;

// GET /map?condition=cortex  -> the agent's 2D map (about 500 tokens)
export const MapResponse = z.object({
  day: z.number().int(),
  rooms: z.array(
    z.object({
      name: Room,
      beliefs: z.number().int(),
      procedures: z.array(z.string()),
      top: z.array(z.string()),
      cracked: z.array(z.string()),
    }),
  ),
  recent_changes: z.array(z.string()),
});
export type MapResponse = z.infer<typeof MapResponse>;

// GET /snapshot?condition=cortex  -> WsEvent of type "snapshot" (see events.ts)

// GET /stats?condition=cortex  -> daily stats for the chart
export const StatsResponse = z.object({
  rows: z.array(
    z.object({
      condition: Condition,
      day: z.number().int(),
      image_bytes: z.number().int(),
      belief_bytes: z.number().int(),
      accuracy_weighted: z.number().nullable(),
    }),
  ),
});

/** Header every mock-world write endpoint requires; value = CORTEX_WRITE_TOKEN. */
export const WRITE_TOKEN_HEADER = "x-cortex-write-token";
