/**
 * Repository interface the engine modules talk to. One Mongo implementation, one in-memory
 * implementation for tests (to be written by the memory track). Keeps Mongo out of the pure modules.
 * docs/spec.md > Data model, > How MongoDB Atlas is load-bearing.
 */
import type { Belief, BeliefState, Capture, CaptureState, Condition, Edge, ImageLevel, Level, Procedure } from "@cortex/schema";
import { NotImplemented } from "../lib/errors.js";
import type { Collections } from "../db.js";

export interface Repo {
  // clock
  currentDay(): Promise<number>;
  setDay(day: number): Promise<void>;
  // captures and levels
  insertCapture(capture: Capture, levels: ImageLevel[], states: CaptureState[]): Promise<void>;
  lastCaptureHash(episodeId: string): Promise<string | null>;
  captureStates(condition: Condition): Promise<CaptureState[]>;
  deleteLevels(captureId: string, levels: Level[]): Promise<number>;
  updateCaptureState(state: CaptureState): Promise<void>;
  levelBytes(captureId: string, levels: Level[]): Promise<number>;
  // beliefs
  insertBelief(belief: Belief, states: BeliefState[], edges: Edge[]): Promise<void>;
  beliefStates(condition: Condition): Promise<BeliefState[]>;
  updateBeliefState(state: BeliefState): Promise<void>;
  findBeliefsBySubjectPredicate(s: string, p: string): Promise<Belief[]>;
  evidenceCaptureIds(beliefId: string): Promise<string[]>;
  // procedures
  proceduresUsing(beliefId: string): Promise<Procedure[]>;
  proceduresByAttribute(room: string, attr: string): Promise<Procedure[]>;
}

/** Mongo-backed repository. Trivial reads implemented; the rest is the memory track's first job. */
export function mongoRepo(c: Collections): Repo {
  return {
    async currentDay() {
      const clock = await c.clock.findOne({ _id: "clock" });
      return clock?.day ?? 0;
    },
    async setDay(day) {
      await c.clock.updateOne({ _id: "clock" }, { $set: { day } }, { upsert: true });
    },
    async insertCapture() {
      throw new NotImplemented("db/repo.insertCapture", "insert capture, image_levels, capture_state in one session");
    },
    async lastCaptureHash(episodeId) {
      const last = await c.captures.find({ episode_id: episodeId }).sort({ ts: -1 }).limit(1).next();
      return last?.phash ?? null;
    },
    async captureStates(condition) {
      return c.capture_state.find({ condition }).toArray();
    },
    async deleteLevels() {
      throw new NotImplemented("db/repo.deleteLevels", "deleteMany on image_levels; return deletedCount");
    },
    async updateCaptureState() {
      throw new NotImplemented("db/repo.updateCaptureState");
    },
    async levelBytes() {
      throw new NotImplemented("db/repo.levelBytes", "aggregate $sum bytes over image_levels");
    },
    async insertBelief() {
      throw new NotImplemented("db/repo.insertBelief");
    },
    async beliefStates(condition) {
      return c.belief_state.find({ condition }).toArray();
    },
    async updateBeliefState() {
      throw new NotImplemented("db/repo.updateBeliefState");
    },
    async findBeliefsBySubjectPredicate(s, p) {
      return c.beliefs.find({ "triple.s": s, "triple.p": p }).toArray() as Promise<Belief[]>;
    },
    async evidenceCaptureIds() {
      throw new NotImplemented("db/repo.evidenceCaptureIds", "edges of type evidence from beliefId, or beliefs.evidence");
    },
    async proceduresUsing() {
      throw new NotImplemented("db/repo.proceduresUsing", "$graphLookup over edges uses/derived_from");
    },
    async proceduresByAttribute() {
      throw new NotImplemented("db/repo.proceduresByAttribute", "procedures.find({room, decision_attributes: attr})");
    },
  };
}
