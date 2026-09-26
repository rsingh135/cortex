/**
 * Capture intake: policy → phash dedupe → ladder → store canonical capture + level docs +
 * per-condition capture_state → queue extraction. docs/spec.md > Capture pipeline, Data model.
 */
import type { IngestCaptureMeta } from "@cortex/schema";
import { NotImplemented } from "../lib/errors.js";
import type { Repo } from "../db/repo.js";

export interface IntakeResult {
  capture_id: string;
  stored: boolean;
  phash: string;
}

export interface Intake {
  ingest(image: Buffer, meta: IngestCaptureMeta): Promise<IntakeResult>;
}

export function createIntake(_repo: Repo): Intake {
  return {
    async ingest() {
      // 1. phash(image); isNearDuplicate against repo.lastCaptureHash(meta.episode_id) → {stored:false}
      // 2. buildLadder(image) → image_levels docs (WebP, bytes recorded)
      // 3. insert capture (page_text kept until extraction succeeds), capture_state per condition
      //    (alive_levels all, ceiling L0, clarity 1, recalls 0, last_recall_day = meta.day)
      // 4. enqueue extraction (src/extraction)
      throw new NotImplemented("ingest/intake");
    },
  };
}
