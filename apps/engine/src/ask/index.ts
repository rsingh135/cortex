/**
 * POST /ask: the one question-answering path the mascot and the palace share.
 * Route -> recall -> answer with citations. docs/contracts.md > POST /ask.
 *
 * Recall runs inside the ledger transaction (it reinforces what it touches); the model call runs
 * after it commits, because holding an Atlas transaction open across an LLM round trip would
 * stall every concurrent ingest.
 */
import {
  AskResponse,
  RecallRequest,
  type AskRequest,
  type RequestRoute,
} from "@cortex/schema";
import type { MemoryStore } from "../db/memory-store.js";
import type { MemoryData } from "../db/memory-data.js";
import { recallMemory } from "../recall/search.js";
import { routeRequest } from "./route.js";
import {
  createExtractiveAnswerer,
  type Answerer,
  type AnswerSource,
} from "./answer.js";
import type { Speaker } from "./speech.js";

export { routeRequest, tokenize } from "./route.js";
export {
  createClaudeAnswerer,
  createExtractiveAnswerer,
  ASK_SYSTEM,
  type Answerer,
} from "./answer.js";
export {
  createElevenLabsSpeaker,
  createAudioStore,
  type Speaker,
  type AudioStore,
} from "./speech.js";

/** How many beliefs the answer may lean on. Keeps the prompt small and the citation list readable. */
export const ASK_RECALL_LIMIT = 8;

export interface AskDeps {
  store: MemoryStore;
  /** Falls back to the deterministic extractive answerer when no model is configured. */
  answerer?: Answerer;
  speaker?: Speaker;
}

export interface Asker {
  ask(request: AskRequest): Promise<AskResponse>;
}

/** Recall log attribution: the eval harness is its own actor, every human surface is Maya. */
const actorFor = (client: AskRequest["client"]) =>
  client === "eval" ? ("eval" as const) : ("maya" as const);

/** The part that runs inside the transaction: decide the route and recall against the ledger. */
export function askMemory(data: MemoryData, request: AskRequest) {
  const routed = routeRequest(request.text, data.procedures);
  const recall = recallMemory(
    data,
    RecallRequest.parse({
      query: request.text,
      condition: request.condition,
      by: actorFor(request.client),
      reason: `ask:${request.client}`,
      dry_run: request.dry_run,
      limit: ASK_RECALL_LIMIT,
    }),
  );
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
  const answerer = deps.answerer ?? createExtractiveAnswerer();
  return {
    async ask(request) {
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
      const audio =
        request.speak && deps.speaker
          ? await deps.speaker.speak(answer).catch(() => undefined)
          : undefined;
      return AskResponse.parse({
        route: recalled.route,
        answer,
        cited,
        recalled_ids: recalled.recalled_ids,
        ...(audio ? { audio_url: audio } : {}),
      });
    },
  };
}
