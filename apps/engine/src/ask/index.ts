/**
 * POST /ask: the one question-answering path the mascot and the palace share.
 * Route -> recall -> answer with citations, optionally spoken.
 * docs/spec.md > The agent. docs/contracts.md > POST /ask.
 *
 * Two paths, one response shape. With a model configured, the router classifies the request, the
 * agent map and the recalled beliefs go in as context, and citations come back as indices into that
 * numbered list — a model cannot fabricate a belief id it was never shown. Without a model (fixture
 * mode, the eval harness, every unit test) a deterministic path answers extractively and decides
 * personal-versus-general from whether recall actually found anything, which is more honest than
 * guessing from wording.
 *
 * Recall runs inside the ledger transaction, because it reinforces what it touches. The model call
 * runs after that commits: holding an Atlas transaction open across an LLM round trip would stall
 * every concurrent ingest.
 */
import { z } from "zod";
import {
  AskResponse,
  RecallRequest,
  type AskRequest,
  type RequestRoute,
} from "@cortex/schema";
import type { Llm } from "../ai/structured.js";
import type { MemoryStore } from "../db/memory-store.js";
import type { MemoryData } from "../db/memory-data.js";
import { buildAgentMap, mapAsText } from "../map/index.js";
import { recallMemory } from "../recall/search.js";
import type { Router } from "../router/index.js";
import type { Tts } from "../voice/tts.js";
import { routeRequest } from "./route.js";
import {
  createExtractiveAnswerer,
  type Answerer,
  type AnswerSource,
} from "./answer.js";

export { routeRequest, tokenize } from "./route.js";
export {
  createExtractiveAnswerer,
  ASK_SYSTEM,
  type Answerer,
} from "./answer.js";
export {
  createTts,
  createAudioStore,
  PREMADE_VOICE,
  type Tts,
  type AudioStore,
} from "../voice/tts.js";

/** How many beliefs the answer may lean on. Keeps the prompt small and the citation list readable. */
export const ASK_RECALL_LIMIT = 8;

const Answer = z.object({
  answer: z.string(),
  /** 1-based numbers of the context entries the answer relied on. */
  cited: z.array(z.number().int().min(1)),
});
const GeneralAnswer = z.object({ answer: z.string() });

export interface AskDeps {
  store: MemoryStore;
  /** Omit to run the deterministic path: extractive answers, no network. */
  llm?: Llm;
  router?: Router;
  tts?: Tts;
  /** Used only by the deterministic path. */
  answerer?: Answerer;
  model?: string;
  recallLimit?: number;
}

export interface Asker {
  ask(request: AskRequest): Promise<z.infer<typeof AskResponse>>;
}

/** Recall log attribution: the eval harness is its own actor, every human surface is Maya. */
const actorFor = (client: AskRequest["client"]) =>
  client === "eval" ? ("eval" as const) : ("maya" as const);

function persona(client: AskRequest["client"]): string {
  const base =
    "You are Cortex, a personal memory for Maya's computer. Answer in the first person as Cortex, warmly and briefly: one to three sentences. Never invent facts that are not in the memory context. When the memory does not contain the answer, say so plainly and do not guess.";
  return client === "mascot"
    ? `${base} You are speaking aloud through a small desktop companion, so keep sentences short and natural to hear.`
    : base;
}

const recallFor = (request: AskRequest, limit: number): RecallRequest =>
  RecallRequest.parse({
    query: request.text,
    condition: request.condition,
    by: actorFor(request.client),
    reason: `ask:${request.client}`,
    dry_run: request.dry_run,
    limit,
    with_images: false,
  });

/** The deterministic path's transaction: decide the route and recall against the ledger. */
export function askMemory(data: MemoryData, request: AskRequest) {
  const routed = routeRequest(request.text, data.procedures);
  const recall = recallMemory(data, recallFor(request, ASK_RECALL_LIMIT));
  const sources: AnswerSource[] = recall.beliefs.map((belief) => ({
    belief_id: belief._id,
    text: belief.text,
    room: belief.room,
    kind: belief.kind,
    confidence: belief.confidence,
    score: belief.score,
  }));
  // Workflow wins outright. Otherwise the recall result itself decides: memories found means the
  // question was about her, nothing found means it was about the world.
  const route: RequestRoute =
    routed.route === "workflow"
      ? "workflow"
      : sources.length
        ? "personal"
        : "general";
  const procedure = routed.procedure_id
    ? data.procedures.find((p) => p._id === routed.procedure_id)
    : undefined;
  return {
    route,
    sources,
    day: data.day,
    recalled_ids: recall.recalled_ids,
    ...(procedure ? { procedure: procedure.name } : {}),
  };
}

export function createAsker(deps: AskDeps): Asker {
  const model = deps.model ?? "claude-opus-5";
  const limit = deps.recallLimit ?? ASK_RECALL_LIMIT;
  const answerer = deps.answerer ?? createExtractiveAnswerer();

  /** Speech never fails an answer: a silent reply beats no reply. */
  const finish = async (
    request: AskRequest,
    base: {
      route: RequestRoute;
      answer: string;
      cited: string[];
      recalled_ids: string[];
    },
  ) => {
    const audioId =
      request.speak && deps.tts
        ? await deps.tts.synthesize(base.answer).catch(() => null)
        : null;
    return AskResponse.parse({
      ...base,
      ...(audioId ? { audio_url: `/audio/${audioId}` } : {}),
    });
  };

  return {
    async ask(request) {
      const llm = deps.llm;
      const router = deps.router;
      if (!llm || !router) {
        const recalled = await deps.store.run(!request.dry_run, (data) =>
          askMemory(data, request),
        );
        const { answer, cited } = await answerer.answer({
          question: request.text,
          route: recalled.route,
          sources: recalled.sources,
          day: recalled.day,
          ...(recalled.procedure ? { procedure: recalled.procedure } : {}),
        });
        return finish(request, {
          route: recalled.route,
          answer,
          cited,
          recalled_ids: recalled.recalled_ids,
        });
      }

      const procedures = await deps.store.run(false, (d) =>
        d.procedures.map((p) => ({
          _id: p._id,
          name: p.name,
          description: p.description,
        })),
      );
      const routed = await router.route(request.text, procedures);

      if (routed.route === "general") {
        const result = await llm.parse({
          model,
          maxTokens: 1024,
          system: `${persona(request.client)} This question needs no personal memory; answer from general knowledge.`,
          messages: [{ role: "user", content: request.text }],
          schema: GeneralAnswer,
        });
        return finish(request, {
          route: "general",
          answer: result.output?.answer ?? "I can't answer that right now.",
          cited: [],
          recalled_ids: [],
        });
      }

      const { map, recalled } = await deps.store.run(
        !request.dry_run,
        (data) => ({
          map: buildAgentMap(data, request.condition),
          recalled: recallMemory(data, recallFor(request, limit)),
        }),
      );
      const context =
        recalled.beliefs
          .map(
            (b, i) =>
              `${i + 1}. [${b.room}] ${b.text} (confidence ${b.confidence.toFixed(2)}, day ${b.created_day})`,
          )
          .join("\n") || "(no relevant memories)";
      const result = await llm.parse({
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
      // Indices, not ids: a number out of range is simply dropped, so nothing unrelated can pulse.
      const cited = [
        ...new Set(
          (result.output?.cited ?? [])
            .map((n) => recalled.beliefs[n - 1]?._id)
            .filter((id): id is string => typeof id === "string"),
        ),
      ];
      // TODO(memory track): a workflow route should start an agent run and return its run_id.
      return finish(request, {
        route: routed.route,
        answer: result.output?.answer ?? "I don't have that in memory yet.",
        cited,
        recalled_ids: recalled.recalled_ids,
      });
    },
  };
}
