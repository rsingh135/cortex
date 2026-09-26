/**
 * POST /ask: route, recall, answer with citations, optionally speak. docs/spec.md > The agent,
 * docs/contracts.md > Mascot. The engine owns the Claude call; clients never hold a model key.
 */
import { z } from "zod";
import { AskResponse, type AskRequest, type RecallRequest } from "@cortex/schema";
import type { Llm } from "../ai/structured.js";
import type { MemoryStore } from "../db/memory-store.js";
import { buildMap, mapAsText } from "../map/index.js";
import { recallMemory } from "../recall/search.js";
import type { Router } from "../router/index.js";
import type { Tts } from "../voice/tts.js";

const Answer = z.object({
  answer: z.string(),
  /** Numbers of the context entries the answer relied on (1-based). */
  cited: z.array(z.number().int().min(1)),
});

const GeneralAnswer = z.object({ answer: z.string() });

export interface Asker {
  ask(request: AskRequest): Promise<z.infer<typeof AskResponse>>;
}

export interface AskerOptions {
  store: MemoryStore;
  llm: Llm;
  router: Router;
  tts?: Tts;
  model?: string;
  recallLimit?: number;
}

function persona(client: AskRequest["client"]): string {
  const base =
    "You are Cortex, a personal memory for Maya's computer. Answer in the first person as Cortex, warmly and briefly: one to three sentences. Never invent facts that are not in the memory context. When the memory does not contain the answer, say so plainly and do not guess.";
  return client === "mascot" ? `${base} You are speaking aloud through a small desktop companion, so keep sentences short and natural to hear.` : base;
}

export function createAsker(opts: AskerOptions): Asker {
  const model = opts.model ?? "claude-opus-5";
  const limit = opts.recallLimit ?? 8;
  const by = (client: AskRequest["client"]): RecallRequest["by"] => (client === "eval" ? "eval" : "maya");

  return {
    async ask(request) {
      const procedures = await opts.store.run(false, (d) => d.procedures.map((p) => ({ _id: p._id, name: p.name, description: p.description })));
      const routed = await opts.router.route(request.text, procedures);

      if (routed.route === "general") {
        const result = await opts.llm.parse({
          model,
          maxTokens: 1024,
          system: `${persona(request.client)} This question needs no personal memory; answer from general knowledge.`,
          messages: [{ role: "user", content: request.text }],
          schema: GeneralAnswer,
        });
        const answer = result.output?.answer ?? "I can't answer that right now.";
        return finish(request, { route: "general", answer, cited: [], recalled_ids: [] });
      }

      const recall: RecallRequest = {
        query: request.text,
        condition: request.condition,
        by: by(request.client),
        reason: `ask: ${request.text.slice(0, 120)}`,
        dry_run: request.dry_run,
        limit,
        with_images: false,
      };
      const { map, recalled } = await opts.store.run(!request.dry_run, (data) => ({
        map: buildMap(data, request.condition),
        recalled: recallMemory(data, recall),
      }));
      const context = recalled.beliefs.map((b, i) => `${i + 1}. [${b.room}] ${b.text} (confidence ${b.confidence.toFixed(2)}, day ${b.created_day})`).join("\n") || "(no relevant memories)";
      const result = await opts.llm.parse({
        model,
        maxTokens: 1024,
        system: `${persona(request.client)}
Memory map (what exists, by room):
${mapAsText(map)}

Relevant memories, numbered:
${context}

Answer the question using only these memories. In "cited", list the numbers of every memory you relied on; leave it empty when none applied.`,
        messages: [{ role: "user", content: request.text }],
        schema: Answer,
      });
      const answer = result.output?.answer ?? "I don't have that in memory yet.";
      const cited = [...new Set((result.output?.cited ?? []).map((n) => recalled.beliefs[n - 1]?._id).filter((id): id is string => typeof id === "string"))];
      // TODO(memory track): a workflow route should start an agent run and return its run_id.
      return finish(request, { route: routed.route, answer, cited, recalled_ids: recalled.recalled_ids });
    },
  };

  async function finish(request: AskRequest, base: { route: "general" | "personal" | "workflow"; answer: string; cited: string[]; recalled_ids: string[] }) {
    const audioId = request.speak && opts.tts ? await opts.tts.synthesize(base.answer) : null;
    return AskResponse.parse({
      route: base.route,
      answer: base.answer,
      cited: base.cited,
      recalled_ids: base.recalled_ids,
      ...(audioId ? { audio_url: `/audio/${audioId}` } : {}),
    });
  }
}
