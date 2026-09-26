/**
 * One Anthropic client for the process. Wrapped with LangSmith when LANGSMITH_API_KEY is set so
 * every extraction, routing and answer call is traced. Null when no key is configured, which is
 * how FIXTURE_MODE runs: modules that need a model then degrade explicitly.
 *
 * An organization-scoped key rejects every request unless it carries anthropic-workspace-id, and
 * the error names no workspace, so ANTHROPIC_WORKSPACE_ID is passed as a default header when set.
 */
import Anthropic from "@anthropic-ai/sdk";
import { wrapAnthropic } from "langsmith/wrappers/anthropic";

export interface AiEnv {
  ANTHROPIC_API_KEY?: string | undefined;
  ANTHROPIC_WORKSPACE_ID?: string | undefined;
  LANGSMITH_API_KEY?: string | undefined;
  LANGSMITH_TRACING?: string | undefined;
}

export function createAnthropicClient(env: AiEnv = process.env): Anthropic | null {
  if (!env.ANTHROPIC_API_KEY) return null;
  const workspace = env.ANTHROPIC_WORKSPACE_ID?.trim();
  const client = new Anthropic({
    apiKey: env.ANTHROPIC_API_KEY,
    ...(workspace
      ? { defaultHeaders: { "anthropic-workspace-id": workspace } }
      : {}),
  });
  const tracing = env.LANGSMITH_API_KEY && env.LANGSMITH_TRACING !== "false";
  return tracing ? wrapAnthropic(client) : client;
}
