/**
 * What Maya tells Cortex becomes memory. Every /ask utterance is kept as a voice note; a statement
 * about herself ("I'm getting a dog") is also turned into voice-sourced beliefs (c0 0.9, the
 * human-sourced starting confidence from docs/spec.md > Parameters) and consolidated like any
 * screenshot extraction, so later questions recall it and the palace shows it with a gold frame.
 */
import { z } from "zod";
import { CONDITIONS, DEFAULT_PARAMS, Kind, PREDICATES, Predicate, Room, ROOMS, type Belief, type VoiceNote } from "@cortex/schema";
import type { Llm } from "../ai/structured.js";
import { consolidateExact } from "../consolidation/index.js";
import type { MemoryData } from "../db/memory-data.js";
import { newId } from "../lib/ids.js";

export const TellBelief = z.object({
  s: z.string().describe("Subject, canonical: 'maya', 'person:priya', 'listing:214'"),
  p: Predicate,
  o: z.string().describe("Object, canonical id or short literal"),
  text: z.string().describe("One plain sentence in the third person about Maya, including the natural category words a later question would use (pet, apartment, budget, job)"),
  kind: Kind.exclude(["summary"]),
  room: Room,
});
export const TellOutput = z.object({ beliefs: z.array(TellBelief) });
export type TellOutput = z.infer<typeof TellOutput>;

export const TELL_SYSTEM = `Maya just told Cortex, her personal memory, something in her own words. Turn it into zero or more small beliefs about her.

Rules:
- Record only what she said or what it directly implies (e.g. "I'm getting a dog" implies she needs a pet-friendly home; mark such conclusions kind "preference").
- Write each belief's text in the third person and include the everyday category words a later question would use, so "getting a dog" also says "pet".
- Subjects and objects are canonical ids where possible: maya, person:<name>, listing:<id>, place:<name>.
- Predicates must be one of: ${PREDICATES.join(", ")}.
- Room must be one of: ${ROOMS.join(", ")}.
- A question or a request is not a fact: return an empty list for those.`;

const STATEMENT_OPENERS = /^(i|i'm|i’m|im|i've|i’ve|ive|i'll|i’ll|my|mine|we|we're|our|remember|note|fyi|from now on|just so you know|update:)\b/i;

/** A statement about Maya rather than a question or a request. Used when no router has decided. */
export function isStatement(text: string): boolean {
  const t = text.trim();
  if (!t || t.endsWith("?")) return false;
  if (/^(what|when|where|who|why|how|which|do|does|did|is|are|can|could|would|should|will|find|show|tell|give|remind|search|run|book|open)\b/i.test(t)) return false;
  return STATEMENT_OPENERS.test(t);
}

const ROOM_HINTS: Array<[RegExp, Belief["room"]]> = [
  [/\b(apartment|listing|rent|budget|landlord|lease|laundry|walk-?up|elevator|move|moving|pet|dog|cat|neighborhood|train)\b/i, "Housing"],
  [/\b(work|job|manager|review|meeting|1:1|deadline|office|design)\b/i, "Work"],
  [/\b(friend|birthday|dinner|party|priya|date|family)\b/i, "Social"],
  [/\b(gym|doctor|dentist|health|run|sleep|allergy)\b/i, "Health"],
  [/\b(errand|groceries|insurance|dmv|bank|order|delivery)\b/i, "Errands"],
];

export function guessRoom(text: string): Belief["room"] {
  for (const [re, room] of ROOM_HINTS) if (re.test(text)) return room;
  return "Misc";
}

/** No-model fallback: keep her words verbatim as one fact, with a predicate guessed from the text. */
export function fallbackTell(text: string): TellOutput {
  const t = text.trim();
  let p: Belief["triple"]["p"] = "summary";
  let o = t.slice(0, 80);
  if (/\b(getting|adopt(ing)?|new)\b.*\b(dog|cat|puppy|kitten|pet)\b/i.test(t)) {
    p = "getting_pet";
    o = /\b(dog|puppy)\b/i.test(t) ? "dog" : /\b(cat|kitten)\b/i.test(t) ? "cat" : "pet";
  } else if (/\bbudget\b.*\$?\s?([\d,]{4,})/i.test(t)) {
    p = "budget_max";
    o = t.match(/\$?\s?([\d,]{4,})/)?.[1]?.replace(/,/g, "") ?? o;
  }
  return { beliefs: [{ s: "maya", p, o, text: `Maya said: ${t}`, kind: "fact", room: guessRoom(t) }] };
}

export async function extractStatement(llm: Llm | undefined, model: string, text: string): Promise<TellOutput> {
  if (!llm) return fallbackTell(text);
  const result = await llm.parse({
    model,
    maxTokens: 1024,
    system: TELL_SYSTEM,
    messages: [{ role: "user", content: text }],
    schema: TellOutput,
  });
  return result.output ?? fallbackTell(text);
}

/** Keeps the utterance itself. Pure over MemoryData so it rides the ledger transaction. */
export function recordVoiceNote(data: MemoryData, transcript: string, client?: VoiceNote["client"]): VoiceNote {
  const note: VoiceNote = {
    _id: newId(),
    day: data.day,
    transcript: transcript.trim(),
    belief_ids: [],
    cracked_procedure_ids: [],
    ...(client ? { client } : {}),
  };
  data.voiceNotes.push(note);
  return note;
}

export interface TellResult {
  note_id: string;
  inserted: string[];
  reinforced: string[];
  texts: string[];
}

/** Writes the statement's beliefs as voice-sourced memory linked to the note as evidence. */
export function applyTell(data: MemoryData, note: VoiceNote, output: TellOutput): TellResult {
  const inserted: string[] = [];
  const reinforced: string[] = [];
  const texts: string[] = [];
  for (const extracted of output.beliefs) {
    const candidate: Belief = {
      _id: newId(),
      triple: { s: extracted.s.trim(), p: extracted.p, o: extracted.o.trim() },
      text: extracted.text.trim(),
      kind: extracted.kind,
      room: extracted.room,
      source: "voice",
      inferred: extracted.kind === "preference",
      pinned: false,
      c0: DEFAULT_PARAMS.c0.voice,
      evidence: [note._id],
      created_day: data.day,
      history: [{ day: data.day, event: "created", note: "Maya said it" }],
    };
    if (!candidate.text || !candidate.triple.s || !candidate.triple.o) continue;
    const outcome = consolidateExact(data, candidate, note._id);
    if (outcome.kind === "inserted") {
      inserted.push(outcome.belief_id);
      for (const condition of CONDITIONS)
        data.beliefStates.push({
          _id: newId(),
          condition,
          belief_id: outcome.belief_id,
          confidence: candidate.c0,
          recalls: 0,
          last_recall_day: data.day,
          status: "active",
          superseded_by: null,
        });
    } else reinforced.push(outcome.belief_id);
    if (!note.belief_ids.includes(outcome.belief_id)) note.belief_ids.push(outcome.belief_id);
    texts.push(candidate.text);
  }
  return { note_id: note._id, inserted, reinforced, texts };
}

/** The spoken acknowledgement for a stored statement. */
export function tellAnswer(result: TellResult): string {
  if (!result.texts.length) return "Noted, but I couldn't turn that into anything to remember.";
  const first = result.texts[0]!.replace(/^Maya said:\s*/i, "").replace(/\.$/, "");
  return result.texts.length === 1 ? `Got it. I'll remember that ${lowerFirst(first)}.` : `Got it. I'll remember ${result.texts.length} things, starting with: ${lowerFirst(first)}.`;
}

function lowerFirst(s: string): string {
  return s.length ? s[0]!.toLowerCase() + s.slice(1) : s;
}

/** Recent things Maya said, for when a question's words don't overlap what she told Cortex. */
export function recentToldBeliefs(data: MemoryData, condition: string, limit = 5): Belief[] {
  const active = new Set(
    data.beliefStates
      .filter((s) => s.condition === condition && (s.status === "active" || s.status === "cracked"))
      .map((s) => s.belief_id),
  );
  return data.beliefs
    .filter((b) => (b.source === "voice" || b.source === "manual") && active.has(b._id))
    .sort((a, b) => b.created_day - a.created_day || (a._id < b._id ? 1 : -1))
    .slice(0, limit);
}
