/**
 * Structured-output calls behind one small interface so extraction, routing and answering share
 * a code path and tests inject a fake without touching the network. Uses the beta `parse` helper
 * with `betaZodOutputFormat`, which is what SDK 0.70.x ships (`output_config.format` is newer).
 */
import type Anthropic from "@anthropic-ai/sdk";
import type { BetaMessageParam } from "@anthropic-ai/sdk/resources/beta/messages/messages";
import { betaZodOutputFormat } from "@anthropic-ai/sdk/helpers/beta/zod";
import type { z } from "zod";

export interface StructuredRequest<T extends z.ZodType> {
  model: string;
  system: string;
  messages: BetaMessageParam[];
  schema: T;
  maxTokens?: number;
}

export interface StructuredResult<T> {
  /** Null when the model refused or returned nothing parseable. */
  output: T | null;
  stopReason: string | null;
}

export interface Llm {
  parse<T extends z.ZodType>(request: StructuredRequest<T>): Promise<StructuredResult<z.infer<T>>>;
}

export function anthropicLlm(client: Anthropic): Llm {
  return {
    async parse(request) {
      const message = await client.beta.messages.parse({
        model: request.model,
        max_tokens: request.maxTokens ?? 4096,
        betas: ["structured-outputs-2025-11-13"],
        system: request.system,
        messages: request.messages,
        output_format: betaZodOutputFormat(request.schema),
      });
      if (message.stop_reason === "refusal") return { output: null, stopReason: "refusal" };
      return { output: message.parsed_output ?? null, stopReason: message.stop_reason };
    },
  };
}
