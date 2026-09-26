/**
 * Maya's month: listings, script, ground truth, questions, usage log.
 * Data lives in ./data as JSON and is validated against @cortex/schema on load.
 * Files are typed stubs until the persona is authored.
 */
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { z } from "zod";
import { CalendarEvent, GroundTruth, Listing, Message, UsageLogEntry } from "@cortex/schema";

const dataDir = join(dirname(fileURLToPath(import.meta.url)), "..", "data");

function load<T>(file: string, schema: z.ZodType<T>): T {
  const raw = JSON.parse(readFileSync(join(dataDir, file), "utf8")) as unknown;
  return schema.parse(raw);
}

/** One scripted action in Maya's month, executed by Playwright with human pacing. */
export const ScriptStep = z.object({
  day: z.number().int().min(0),
  app: z.enum(["mockloft", "inbox", "calendar", "landlord_chat"]),
  episode: z.string(),
  action: z.enum(["open", "click", "reject", "message", "read", "dwell"]),
  target: z.string().optional(),
  text: z.string().optional(),
  /** Seconds to wait before this step, for human-like pacing. */
  pause_s: z.number().nonnegative().default(1.5),
});
export type ScriptStep = z.infer<typeof ScriptStep>;

export const listings = () => load("listings.json", z.array(Listing));
export const mayaScript = () => load("maya-script.json", z.array(ScriptStep));
export const groundTruth = () => load("ground-truth.json", GroundTruth);
export const usageLog = () => load("usage-log.json", z.array(UsageLogEntry));
export const inboxSeed = () => load("inbox.json", z.array(Message));
export const calendarSeed = () => load("calendar.json", z.array(CalendarEvent));
