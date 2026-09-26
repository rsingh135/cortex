/** Screenshot intake: validate, deduplicate, build canonical levels and condition ledgers. */
import sharp from "sharp";
import {
  CONDITIONS,
  LEVELS,
  IngestCaptureMeta,
  type Capture,
} from "@cortex/schema";
import type { MemoryStore } from "../db/memory-store.js";
import { advanceMemory } from "../forgetting/sweep.js";
import { buildLadder, type LadderRung } from "../ladder/index.js";
import { newId } from "../lib/ids.js";
import { phash } from "./phash.js";
import { isNearDuplicate } from "./policy.js";

export const MAX_CAPTURE_BYTES = 10 * 1024 * 1024;
export const MAX_CAPTURE_PIXELS = 16_000_000;

export interface IntakeResult {
  capture_id: string;
  stored: boolean;
  phash: string;
}

export interface Intake {
  ingest(image: Buffer, meta: IngestCaptureMeta): Promise<IntakeResult>;
}

/** An unchanged picture can still be a meaningful new action or newly visible text. */
function sameContext(previous: Capture, meta: IngestCaptureMeta): boolean {
  return (
    previous.url === meta.url &&
    previous.app === meta.app &&
    previous.title === meta.title &&
    previous.action.type === meta.action.type &&
    previous.action.text === meta.action.text &&
    JSON.stringify(previous.action.bbox) === JSON.stringify(meta.action.bbox) &&
    previous.page_text === meta.page_text &&
    previous.listing?.listing_id === meta.listing?.listing_id &&
    JSON.stringify(previous.listing?.attrs) === JSON.stringify(meta.listing?.attrs)
  );
}

async function prepareImage(image: Buffer): Promise<{
  hash: string;
  rungs: LadderRung[];
}> {
  if (!image.byteLength || image.byteLength > MAX_CAPTURE_BYTES)
    throw new RangeError("Screenshot must be nonempty and at most 10 MiB");

  try {
    const metadata = await sharp(image, {
      limitInputPixels: MAX_CAPTURE_PIXELS,
    }).metadata();
    if (metadata.format !== "png" && metadata.format !== "webp")
      throw new RangeError("Screenshot must be a PNG or WebP image");
    if (
      !metadata.width ||
      !metadata.height ||
      metadata.width * metadata.height > MAX_CAPTURE_PIXELS
    )
      throw new RangeError("Screenshot must contain at most 16 million pixels");
    if ((metadata.pages ?? 1) !== 1)
      throw new RangeError("Screenshot must be a single still image");
    const [hash, rungs] = await Promise.all([phash(image), buildLadder(image)]);
    return { hash, rungs };
  } catch (error) {
    if (error instanceof RangeError) throw error;
    throw new RangeError(
      "Screenshot must be a valid PNG or WebP image with at most 16 million pixels",
    );
  }
}

export function createIntake(store: MemoryStore): Intake {
  return {
    async ingest(image, input) {
      const meta = IngestCaptureMeta.parse(input);
      if (!meta.episode_id.trim())
        throw new RangeError("Capture requires a nonempty episode_id");
      // Encoding is asynchronous; transactions only perform synchronous ledger updates.
      const { hash, rungs } = await prepareImage(image);
      const captureId = newId();
      const ts = new Date().toISOString();

      return store.run(true, (data) => {
        if (meta.day < data.day)
          throw new RangeError("Capture day cannot precede the current memory day");
        let episode = data.episodes.find((e) => e._id === meta.episode_id);
        if (episode?.ended_at)
          throw new RangeError("Cannot ingest a capture into an ended episode");
        if (episode && (episode.day !== meta.day || episode.actor !== meta.actor))
          throw new RangeError("Capture day and actor must match its episode");

        if (meta.day > data.day) advanceMemory(data, meta.day);

        const previous = data.captures
          .filter((capture) => capture.episode_id === meta.episode_id)
          .reduce<Capture | undefined>(
            (latest, capture) =>
              !latest || capture.ts >= latest.ts ? capture : latest,
            undefined,
          );
        if (
          previous &&
          sameContext(previous, meta) &&
          isNearDuplicate(hash, previous.phash)
        )
          return { capture_id: previous._id, stored: false, phash: hash };

        // The scripted browser supplies episode ids directly, without a start request.
        if (!episode) {
          episode = {
            _id: meta.episode_id,
            day: meta.day,
            actor: meta.actor,
            app: meta.app,
            started_at: ts,
            capture_count: 0,
          };
          data.episodes.push(episode);
        }
        data.captures.push({
          _id: captureId,
          ...meta,
          ts,
          phash: hash,
          extracted: false,
          belief_ids: [],
          l0_bytes: rungs.find((rung) => rung.level === "L0")!.bytes,
        });
        data.levels.push(
          ...rungs.map((rung) => ({
            _id: newId(),
            capture_id: captureId,
            level: rung.level,
            width: rung.width,
            height: rung.height,
            bytes: rung.bytes,
            data: new Uint8Array(rung.data),
          })),
        );
        for (const condition of CONDITIONS)
          data.captureStates.push({
            _id: newId(),
            condition,
            capture_id: captureId,
            alive_levels: [...LEVELS],
            ceiling: "L0",
            clarity: 1,
            recalls: 0,
            last_recall_day: meta.day,
          });
        episode.capture_count += 1;
        // Refresh this day's byte totals now that the new levels are in the ledger.
        advanceMemory(data, meta.day);
        return { capture_id: captureId, stored: true, phash: hash };
      });
    },
  };
}
