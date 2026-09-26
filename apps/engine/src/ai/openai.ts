/**
 * OpenAI-backed `Llm`: structured outputs through the Responses API (`responses.parse` with
 * `zodTextFormat`). Callers keep building Anthropic-shaped messages (text and base64 image
 * blocks); this adapter translates them into Responses input items so extraction, routing and
 * answering are provider-neutral.
 */
import type OpenAI from "openai";
import { zodTextFormat } from "openai/helpers/zod";
import type { ResponseInput, ResponseInputContent } from "openai/resources/responses/responses";
import type { BetaMessageParam } from "@anthropic-ai/sdk/resources/beta/messages/messages";
import type { z } from "zod";
import type { Llm, StructuredRequest, StructuredResult } from "./structured.js";

/** The slice of the OpenAI client the adapter uses; tests inject a fake with this shape. */
export interface OpenAiLike {
  responses: {
    parse: (params: Record<string, unknown>) => Promise<OpenAiParsedResponse>;
  };
}

export interface OpenAiParsedResponse {
  output_parsed?: unknown;
  output?: Array<{ type: string; content?: Array<{ type: string; refusal?: string }> }>;
  status?: string;
  incomplete_details?: { reason?: string } | null;
}

/** Translate one Anthropic-shaped message into Responses API input content. */
export function toResponsesInput(messages: readonly BetaMessageParam[]): ResponseInput {
  return messages.map((m) => {
    if (typeof m.content === "string") return { role: m.role, content: m.content };
    const content: ResponseInputContent[] = [];
    for (const block of m.content) {
      if (block.type === "text") content.push({ type: "input_text", text: block.text });
      else if (block.type === "image" && block.source.type === "base64") {
        content.push({ type: "input_image", image_url: `data:${block.source.media_type};base64,${block.source.data}`, detail: "auto" });
      } else if (block.type === "image" && block.source.type === "url") {
        content.push({ type: "input_image", image_url: block.source.url, detail: "auto" });
      }
    }
    if (m.role === "assistant") {
      const text = content.filter((c): c is Extract<ResponseInputContent, { type: "input_text" }> => c.type === "input_text").map((c) => c.text).join("\n");
      return { role: "assistant", content: text };
    }
    return { role: "user", content };
  });
}

function refusalOf(response: OpenAiParsedResponse): string | null {
  for (const item of response.output ?? []) {
    if (item.type !== "message") continue;
    for (const part of item.content ?? []) if (part.type === "refusal") return part.refusal ?? "refusal";
  }
  return null;
}

export function openaiLlm(client: OpenAiLike): Llm {
  return {
    async parse<T extends z.ZodType>(request: StructuredRequest<T>): Promise<StructuredResult<z.infer<T>>> {
      const response = await client.responses.parse({
        model: request.model,
        instructions: request.system,
        input: toResponsesInput(request.messages),
        max_output_tokens: request.maxTokens ?? 4096,
        text: { format: zodTextFormat(request.schema, "output") },
      });
      if (refusalOf(response) !== null) return { output: null, stopReason: "refusal" };
      if (response.status === "incomplete") return { output: null, stopReason: response.incomplete_details?.reason ?? "incomplete" };
      const parsed = response.output_parsed;
      const checked = parsed === undefined || parsed === null ? null : request.schema.safeParse(parsed);
      if (!checked || !checked.success) return { output: null, stopReason: response.status ?? "unparsed" };
      return { output: checked.data as z.infer<T>, stopReason: response.status ?? "completed" };
    },
  };
}

/** Adapter over the real SDK client; kept separate so tests never construct `OpenAI`. */
export function openaiLlmFromClient(client: OpenAI): Llm {
  return openaiLlm(client as unknown as OpenAiLike);
}
