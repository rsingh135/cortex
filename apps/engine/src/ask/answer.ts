/**
 * Turns recalled beliefs into the sentence the mascot speaks. docs/spec.md > The agent.
 *
 * Two implementations behind one interface: claude-opus-5 for the demo, and a deterministic
 * extractive answer used in fixture mode, in tests, and whenever ANTHROPIC_API_KEY is unset.
 * Both cite belief ids, because the palace pulses exactly what the answer leaned on.
 */
import Anthropic from "@anthropic-ai/sdk";
import { betaZodOutputFormat } from "@anthropic-ai/sdk/helpers/beta/zod";
import { z } from "zod";
import type { RequestRoute } from "@cortex/schema";

export interface AnswerSource {
  belief_id: string;
  text: string;
  room: string;
  kind: string;
  confidence: number;
  score: number;
}

export interface AnswerInput {
  question: string;
  route: RequestRoute;
  sources: AnswerSource[];
  /** Name of the procedure the workflow route matched, when there is one. */
  procedure?: string;
  day: number;
}

export interface Answer {
  answer: string;
  cited: string[];
}

export interface Answerer {
  answer(input: AnswerInput): Promise<Answer>;
}

const AnswerOutput = z.object({
  /** Two sentences at most; the mascot speaks this aloud. */
  answer: z.string(),
  /** Ids of the supplied beliefs the answer actually used. */
  cited: z.array(z.string()),
});

export const ASK_SYSTEM = `You are Cortex, a memory that belongs to one person. You answer in their own terms, briefly.

Rules:
- Answer only from the supplied memories. Never invent a fact, a number, or a name.
- If the memories do not cover the question, say so plainly in one sentence. Do not guess.
- Cite the belief ids you relied on. Cite nothing when you relied on nothing.
- Two sentences at most. Speak naturally; this is read aloud.
- Lower-confidence memories deserve hedging ("I think", "you mentioned once"). High-confidence ones do not.`;

function sourceBlock(sources: readonly AnswerSource[]): string {
  if (!sources.length) return "(no memories were recalled)";
  return sources
    .map(
      (s) =>
        `- id=${s.belief_id} room=${s.room} kind=${s.kind} confidence=${s.confidence.toFixed(2)}: ${s.text}`,
    )
    .join("\n");
}

export function askUserText(input: AnswerInput): string {
  const lines = [
    `Today is simulated day ${input.day}.`,
    `Route: ${input.route}.`,
  ];
  if (input.procedure) lines.push(`Matched workflow: ${input.procedure}.`);
  lines.push("", "Recalled memories:", sourceBlock(input.sources), "", `Question: ${input.question}`);
  return lines.join("\n");
}

export function createClaudeAnswerer(
  client: Anthropic,
  model = "claude-opus-5",
): Answerer {
  return {
    async answer(input) {
      const message = await client.beta.messages.parse({
        model,
        max_tokens: 1024,
        betas: ["structured-outputs-2025-11-13"],
        system: ASK_SYSTEM,
        messages: [{ role: "user", content: askUserText(input) }],
        output_format: betaZodOutputFormat(AnswerOutput),
      });
      if (message.stop_reason === "refusal")
        return { answer: "I would rather not answer that.", cited: [] };
      const parsed = message.parsed_output;
      if (!parsed) throw new Error("ask: model returned no parsed output");
      // A model may cite an id that was not offered; drop those rather than pulse the wrong memory.
      const offered = new Set(input.sources.map((s) => s.belief_id));
      return {
        answer: parsed.answer.trim(),
        cited: [...new Set(parsed.cited)].filter((id) => offered.has(id)),
      };
    },
  };
}

/**
 * No model, no network: quote the strongest memory. Good enough for the eval harness and honest
 * about an empty memory, which is the property the forgetting comparison actually measures.
 */
export function createExtractiveAnswerer(): Answerer {
  return {
    async answer(input) {
      const [first, second] = input.sources;
      if (!first)
        return {
          answer:
            input.route === "workflow"
              ? "I know the workflow but have no memories to run it from yet."
              : "I don't have anything about that in memory.",
          cited: [],
        };
      const lead =
        input.route === "workflow" && input.procedure
          ? `I'd run ${input.procedure}: ${first.text}`
          : first.text;
      const hedged = first.confidence < 0.5 ? `I think ${lowerFirst(lead)}` : lead;
      const sentences = [sentence(hedged)];
      const cited = [first.belief_id];
      if (second && second.score >= first.score * 0.6) {
        sentences.push(sentence(second.text));
        cited.push(second.belief_id);
      }
      return { answer: sentences.join(" "), cited };
    },
  };
}

const lowerFirst = (text: string) =>
  text.charAt(0).toLowerCase() + text.slice(1);

const sentence = (text: string) => {
  const trimmed = text.trim();
  if (!trimmed) return "";
  const capitalized = trimmed.charAt(0).toUpperCase() + trimmed.slice(1);
  return /[.!?…]$/.test(capitalized) ? capitalized : `${capitalized}.`;
};
