/**
 * Palace view model. Flattened from `@cortex/schema` documents plus the cortex-condition state
 * ledgers, so the scene never has to join collections. Extra fields beyond ARCHITECTURE.md
 * (`c0`, `recallDays`, `lastRecallDay`, `supersededBy`, `l0Bytes`, `url`) let the fixture sweep
 * re-run the forgetting math for any day.
 */
import type { App, BeliefStatus, EdgeType, Kind, Level, ProcedureStatus, Room, Source } from "@cortex/schema";

export interface PalaceHistoryEntry {
  day: number;
  event: string;
  note?: string;
}

export interface PalaceBelief {
  id: string;
  text: string;
  kind: Kind;
  room: Room;
  source: Source;
  inferred: boolean;
  pinned: boolean;
  status: BeliefStatus;
  confidence: number;
  recalls: number;
  evidence: string[];
  createdDay: number;
  history: PalaceHistoryEntry[];
  ruleText?: string;
  /** Initial confidence; the sweep decays from here. */
  c0: number;
  /** Days on which this belief was recalled (cortex condition). `recalls` is the count of those <= current day. */
  recallDays: number[];
  lastRecallDay: number;
  supersededBy: string | null;
}

export interface PalaceCapture {
  id: string;
  app: App;
  title: string;
  /** Creation day. */
  day: number;
  aliveLevels: Level[];
  ceiling: Level | null;
  clarity: number;
  recalls: number;
  /** Data URL (fixture) or engine image URL (live); null when forgotten or not yet drawn. */
  textureUrl: string | null;
  /** Fixture only: a real recorded screenshot under /captures that stands in for this capture. */
  screenFile?: string;
  recallDays: number[];
  lastRecallDay: number;
  /** Original L0 byte size; keep-everything accounting survives level deletion. */
  l0Bytes: number;
  url: string;
}

export interface PalaceProcedureStep {
  n: number;
  do: string;
  uses: string[];
}

export interface PalaceProcedure {
  id: string;
  name: string;
  description: string;
  room: Room;
  status: ProcedureStatus;
  steps: PalaceProcedureStep[];
  crackedBy: string[];
}

export interface PalaceEdge {
  id: string;
  from: string;
  to: string;
  type: EdgeType;
}

export interface PalaceBytes {
  cortex: number;
  keepAll: number;
}

export interface PalaceSnapshot {
  day: number;
  beliefs: PalaceBelief[];
  captures: PalaceCapture[];
  procedures: PalaceProcedure[];
  edges: PalaceEdge[];
  bytes: PalaceBytes;
}

export type { PalaceLayout, PalaceRoom, Placement, PlacementKind, RoomLayout, Vec3 } from "./layout";

export function emptySnapshot(day = 1): PalaceSnapshot {
  return { day, beliefs: [], captures: [], procedures: [], edges: [], bytes: { cortex: 0, keepAll: 0 } };
}

/** Beliefs the palace shows on pedestals: alive in their room. */
export function isShownInRoom(belief: PalaceBelief): boolean {
  return belief.status === "active" || belief.status === "cracked";
}
