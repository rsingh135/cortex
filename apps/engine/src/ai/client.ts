/**
 * Picks the model provider for the process and builds one client for it, wrapped with LangSmith
 * when LANGSMITH_API_KEY is set so every extraction, routing and answer call is traced.
 *
 *   LLM_PROVIDER=openai | anthropic | none   (default: anthropic if ANTHROPIC_API_KEY, else openai
 *                                             if OPENAI_API_KEY, else none)
 *
 * `none` is how FIXTURE_MODE runs: modules that need a model then degrade explicitly (503s).
 */
import Anthropic from "@anthropic-ai/sdk";
import OpenAI from "openai";
import { wrapAnthropic } from "langsmith/wrappers/anthropic";
import { wrapOpenAI } from "langsmith/wrappers/openai";
import { anthropicLlm, type Llm } from "./structured.js";
import { openaiLlmFromClient } from "./openai.js";

export type Provider = "openai" | "anthropic" | "none";

export interface AiEnv {
  LLM_PROVIDER?: string | undefined;
  ANTHROPIC_API_KEY?: string | undefined;
  /** Required by org-level keys: Anthropic rejects them without the anthropic-workspace-id header. */
  ANTHROPIC_WORKSPACE_ID?: string | undefined;
  OPENAI_API_KEY?: string | undefined;
  LANGSMITH_API_KEY?: string | undefined;
  LANGSMITH_TRACING?: string | undefined;
  EXTRACTION_MODEL?: string | undefined;
  REASONING_MODEL?: string | undefined;
  OPENAI_EXTRACTION_MODEL?: string | undefined;
  OPENAI_ROUTER_MODEL?: string | undefined;
  OPENAI_ASK_MODEL?: string | undefined;
}

export interface Models {
  extraction: string;
  router: string;
  ask: string;
}

export interface LlmSetup {
  provider: Provider;
  llm: Llm | null;
  models: Models;
}

export const DEFAULT_MODELS: Record<Exclude<Provider, "none">, Models> = {
  openai: { extraction: "gpt-5.4-mini", router: "gpt-5.4-mini", ask: "gpt-5.4" },
  anthropic: { extraction: "claude-sonnet-5", router: "claude-sonnet-5", ask: "claude-opus-5" },
};

export function selectProvider(env: AiEnv = process.env): Provider {
  const forced = env.LLM_PROVIDER?.trim().toLowerCase();
  if (forced === "openai" || forced === "anthropic" || forced === "none") {
    if (forced === "openai" && !env.OPENAI_API_KEY) throw new Error("LLM_PROVIDER=openai but OPENAI_API_KEY is not set");
    if (forced === "anthropic" && !env.ANTHROPIC_API_KEY) throw new Error("LLM_PROVIDER=anthropic but ANTHROPIC_API_KEY is not set");
    return forced;
  }
  if (env.ANTHROPIC_API_KEY) return "anthropic";
  if (env.OPENAI_API_KEY) return "openai";
  return "none";
}

export function modelsFor(provider: Provider, env: AiEnv = process.env): Models {
  if (provider === "openai") {
    const d = DEFAULT_MODELS.openai;
    return {
      extraction: env.OPENAI_EXTRACTION_MODEL ?? d.extraction,
      router: env.OPENAI_ROUTER_MODEL ?? d.router,
      ask: env.OPENAI_ASK_MODEL ?? d.ask,
    };
  }
  const d = DEFAULT_MODELS.anthropic;
  return {
    extraction: env.EXTRACTION_MODEL ?? d.extraction,
    router: env.EXTRACTION_MODEL ?? d.router,
    ask: env.REASONING_MODEL ?? d.ask,
  };
}

function tracing(env: AiEnv): boolean {
  return Boolean(env.LANGSMITH_API_KEY) && env.LANGSMITH_TRACING !== "false";
}

export function createAnthropicClient(env: AiEnv = process.env): Anthropic | null {
  if (!env.ANTHROPIC_API_KEY) return null;
  const workspace = env.ANTHROPIC_WORKSPACE_ID?.trim();
  const client = new Anthropic({ apiKey: env.ANTHROPIC_API_KEY, ...(workspace ? { defaultHeaders: { "anthropic-workspace-id": workspace } } : {}) });
  return tracing(env) ? wrapAnthropic(client) : client;
}

export function createOpenAiClient(env: AiEnv = process.env): OpenAI | null {
  if (!env.OPENAI_API_KEY) return null;
  const client = new OpenAI({ apiKey: env.OPENAI_API_KEY });
  return tracing(env) ? (wrapOpenAI(client) as unknown as OpenAI) : client;
}

/** The process-wide model setup: provider, an `Llm` (or null), and the model names per job. */
export function createLlm(env: AiEnv = process.env): LlmSetup {
  const provider = selectProvider(env);
  const models = modelsFor(provider, env);
  if (provider === "openai") {
    const client = createOpenAiClient(env);
    return { provider, llm: client ? openaiLlmFromClient(client) : null, models };
  }
  if (provider === "anthropic") {
    const client = createAnthropicClient(env);
    return { provider, llm: client ? anthropicLlm(client) : null, models };
  }
  return { provider, llm: null, models };
}
