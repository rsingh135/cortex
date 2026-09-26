/**
 * One Anthropic client for the process. Wrapped with LangSmith when LANGSMITH_API_KEY is set so
 * every extraction, routing and answer call is traced. Null when no key is configured, which is
 * how FIXTURE_MODE runs: modules that need a model then degrade explicitly.
 */
import Anthropic from "@anthropic-ai/sdk";
import { wrapAnthropic } from "langsmith/wrappers/anthropic";

export interface AiEnv {
  ANTHROPIC_API_KEY?: string | undefined;
  LANGSMITH_API_KEY?: string | undefined;
  LANGSMITH_TRACING?: string | undefined;
}

export function createAnthropicClient(env: AiEnv = process.env): Anthropic | null {
  if (!env.ANTHROPIC_API_KEY) return null;
  const client = new Anthropic({ apiKey: env.ANTHROPIC_API_KEY });
  const tracing = env.LANGSMITH_API_KEY && env.LANGSMITH_TRACING !== "false";
  return tracing ? wrapAnthropic(client) : client;
}
