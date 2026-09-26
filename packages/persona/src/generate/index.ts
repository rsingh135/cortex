/**
 * Regenerates every persona fixture deterministically.
 *
 *   pnpm --filter @cortex/persona generate [--seed 7]
 */
import { writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { z } from "zod";
import { CalendarEvent, GroundTruth, Listing, Message, UsageLogEntry } from "@cortex/schema";
import { ScriptStep } from "../index";
import { STYLE, TRUE_RULES } from "./decisions";
import { generateCalendar, generateInbox } from "./life";
import { generateListings } from "./listings";
import { mulberry32 } from "./prng";
import { generateQuestions, generateUsageLog } from "./questions";
import { generateScript } from "./script";

export interface Persona {
  listings: Listing[];
  script: ScriptStep[];
  groundTruth: GroundTruth;
  usageLog: UsageLogEntry[];
  inbox: Message[];
  calendar: CalendarEvent[];
}

export const DEFAULT_SEED = 42;

export function generatePersona(seed: number = DEFAULT_SEED): Persona {
  const rng = mulberry32(seed);
  const listings = z.array(Listing).parse(generateListings(rng));
  const inbox = z.array(Message).parse(generateInbox(rng));
  const script = z.array(ScriptStep).parse(generateScript(rng, listings, inbox));
  const questions = generateQuestions(rng, listings);
  const groundTruth = GroundTruth.parse({ rules: TRUE_RULES, style: STYLE, questions });
  const usageLog = z.array(UsageLogEntry).parse(generateUsageLog());
  const calendar = z.array(CalendarEvent).parse(generateCalendar());
  return { listings, script, groundTruth, usageLog, inbox, calendar };
}

export function writePersona(persona: Persona, dataDir: string): void {
  const out = (name: string, value: unknown): void => writeFileSync(join(dataDir, name), `${JSON.stringify(value, null, 2)}\n`);
  out("listings.json", persona.listings);
  out("maya-script.json", persona.script);
  out("ground-truth.json", persona.groundTruth);
  out("usage-log.json", persona.usageLog);
  out("inbox.json", persona.inbox);
  out("calendar.json", persona.calendar);
}

if (process.argv[1] && /generate[/\\]index\.ts$/.test(process.argv[1])) {
  const seedArg = process.argv.indexOf("--seed");
  const seed = seedArg >= 0 ? Number(process.argv[seedArg + 1]) : DEFAULT_SEED;
  const persona = generatePersona(seed);
  const dataDir = join(dirname(fileURLToPath(import.meta.url)), "..", "..", "data");
  writePersona(persona, dataDir);
  const byGroup = persona.groundTruth.questions.reduce<Record<string, number>>((acc, q) => ({ ...acc, [q.group]: (acc[q.group] ?? 0) + 1 }), {});
  console.log(`seed ${seed}: ${persona.listings.length} listings, ${persona.script.length} script steps, ${persona.groundTruth.questions.length} questions ${JSON.stringify(byGroup)}, ${persona.usageLog.length} usage entries, ${persona.inbox.length} inbox messages, ${persona.calendar.length} calendar events`);
}
