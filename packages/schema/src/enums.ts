import { z } from "zod";

/** Semantic rooms of the palace. Fixed list; extraction picks exactly one per belief. */
export const ROOMS = ["Housing", "Work", "Social", "Health", "Errands", "Misc"] as const;
export const Room = z.enum(ROOMS);
export type Room = z.infer<typeof Room>;

/** What kind of thing a belief is. `summary` is the end-of-episode sentence. */
export const KINDS = ["fact", "event", "person", "preference", "routine", "style", "summary"] as const;
export const Kind = z.enum(KINDS);
export type Kind = z.infer<typeof Kind>;

export const BELIEF_STATUSES = ["active", "cracked", "superseded", "tombstoned", "forgotten"] as const;
export const BeliefStatus = z.enum(BELIEF_STATUSES);
export type BeliefStatus = z.infer<typeof BeliefStatus>;

export const PROCEDURE_STATUSES = ["active", "cracked"] as const;
export const ProcedureStatus = z.enum(PROCEDURE_STATUSES);
export type ProcedureStatus = z.infer<typeof ProcedureStatus>;

/** Rungs of the resolution ladder, sharpest first. */
export const LEVELS = ["L0", "L1", "L2", "L3"] as const;
export const Level = z.enum(LEVELS);
export type Level = z.infer<typeof Level>;

/** The three memory strategies compared in the evaluation. `cortex` is also the live demo condition. */
export const CONDITIONS = ["cortex", "keep_all", "blur_by_age"] as const;
export const Condition = z.enum(CONDITIONS);
export type Condition = z.infer<typeof Condition>;

/** Where a belief came from. `learner` = workflow learner output; `manual` = palace edit. */
export const SOURCES = ["screen", "voice", "agent_outcome", "learner", "manual"] as const;
export const Source = z.enum(SOURCES);
export type Source = z.infer<typeof Source>;

export const ACTORS = ["maya", "agent"] as const;
export const Actor = z.enum(ACTORS);
export type Actor = z.infer<typeof Actor>;

/** The mock world's four surfaces, plus `desktop` for real screenshots the mascot captures. */
export const APPS = ["mockloft", "inbox", "calendar", "landlord_chat", "desktop"] as const;
export const App = z.enum(APPS);
export type App = z.infer<typeof App>;

export const ACTION_TYPES = ["load", "click", "submit", "dwell"] as const;
export const ActionType = z.enum(ACTION_TYPES);
export type ActionType = z.infer<typeof ActionType>;

/**
 * Closed predicate set so exact-match consolidation actually fires.
 * Objects are canonical ids where possible: `listing:214`, `person:priya`, `place:union_square`.
 */
export const PREDICATES = [
  "viewed",
  "rejected",
  "messaged",
  "requires",
  "avoids",
  "prefers",
  "budget_max",
  "lives_in",
  "moving_to",
  "works_at",
  "works_near",
  "knows",
  "has_event",
  "attends",
  "subscribed_to",
  "has_pet",
  "getting_pet",
  "writes_like",
  "summary",
  "pinned",
] as const;
export const Predicate = z.enum(PREDICATES);
export type Predicate = z.infer<typeof Predicate>;

export const EDGE_TYPES = ["derived_from", "uses", "evidence", "supersedes"] as const;
export const EdgeType = z.enum(EDGE_TYPES);
export type EdgeType = z.infer<typeof EdgeType>;

/**
 * Listing attributes the learner may write rules over. Parsed from captures, never read from the mock-world DB.
 * `walkup_floor` is derived: the floor when there is no elevator, else 0. It lets a single-attribute rule
 * express "no walk-up above the 3rd floor" (walkup_floor <= 3).
 */
export const LISTING_ATTRS = ["price", "neighborhood", "train", "floor", "elevator", "laundry", "pets", "walkup_floor"] as const;
export const ListingAttr = z.enum(LISTING_ATTRS);
export type ListingAttr = z.infer<typeof ListingAttr>;

export const RULE_OPS = ["<=", ">=", "==", "!=", "in"] as const;
export const RuleOp = z.enum(RULE_OPS);
export type RuleOp = z.infer<typeof RuleOp>;

/** `skip`: a hard requirement; violators are skipped. `prefer`: soft; ranks, never skips. */
export const RULE_OUTCOMES = ["skip", "prefer"] as const;
export const RuleOutcome = z.enum(RULE_OUTCOMES);
export type RuleOutcome = z.infer<typeof RuleOutcome>;

export const DECISION_OUTCOMES = ["unopened", "rejected", "messaged"] as const;
export const DecisionOutcome = z.enum(DECISION_OUTCOMES);
export type DecisionOutcome = z.infer<typeof DecisionOutcome>;

/** Which hunt a listing appears in. */
export const HUNTS = ["hunt1", "hunt2", "agent", "rerun", "pool"] as const;
export const Hunt = z.enum(HUNTS);
export type Hunt = z.infer<typeof Hunt>;

export const CLOCK_MODES = ["simulated", "realtime"] as const;
export const ClockMode = z.enum(CLOCK_MODES);
export type ClockMode = z.infer<typeof ClockMode>;

/** Every event the engine pushes to the palace over WebSocket. */
export const WS_EVENT_TYPES = [
  "capture.created",
  "capture.recalled",
  "level.deleted",
  "belief.created",
  "belief.reinforced",
  "belief.recalled",
  "belief.updated",
  "belief.superseded",
  "belief.tombstoned",
  "belief.forgotten",
  "edge.created",
  "procedure.created",
  "procedure.cracked",
  "procedure.healed",
  "procedure.step",
  "clock.advanced",
  "voice.received",
  "agent.drafts",
  "agent.draft_sent",
  "snapshot",
] as const;
export const WsEventType = z.enum(WS_EVENT_TYPES);
export type WsEventType = z.infer<typeof WsEventType>;

export const REQUEST_ROUTES = ["general", "personal", "workflow"] as const;
export const RequestRoute = z.enum(REQUEST_ROUTES);
export type RequestRoute = z.infer<typeof RequestRoute>;

export const QUESTION_GROUPS = ["used_often", "seen_once", "rare_important"] as const;
export const QuestionGroup = z.enum(QUESTION_GROUPS);
export type QuestionGroup = z.infer<typeof QuestionGroup>;
