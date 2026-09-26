/**
 * Screenshot → beliefs with claude-sonnet-5 (vision, strict JSON via structured outputs).
 * Feed the L1 rung, not L0: cheaper and accurate enough (docs/spec.md > Belief extraction).
 */
import Anthropic from "@anthropic-ai/sdk";
import { betaZodOutputFormat } from "@anthropic-ai/sdk/helpers/beta/zod";
import { NotImplemented } from "../lib/errors.js";
import { EXTRACTION_SYSTEM, extractionUserText } from "./prompt.js";
import { ExtractionOutput } from "./schema.js";

export interface ExtractInput {
  /** WebP bytes of the L1 rung. */
  image: Buffer;
  url: string;
  title: string;
  action: string;
  pageText?: string;
  /** Short descriptions of the previous 3 captures. */
  previous: string[];
}

export interface Extractor {
  extract(input: ExtractInput): Promise<ExtractionOutput>;
}

export function createExtractor(client: Anthropic | null, model = "claude-sonnet-5"): Extractor {
  return {
    async extract(input) {
      if (!client) throw new NotImplemented("extraction/extract", "no Anthropic client (ANTHROPIC_API_KEY unset)");
      // TODO(memory track): wrap with LangSmith traceable() and store trace_url on each belief.
      const message = await client.beta.messages.parse({
        model,
        max_tokens: 4096,
        betas: ["structured-outputs-2025-11-13"],
        system: EXTRACTION_SYSTEM,
        messages: [
          {
            role: "user",
            content: [
              { type: "image", source: { type: "base64", media_type: "image/webp", data: input.image.toString("base64") } },
              { type: "text", text: extractionUserText(input) },
            ],
          },
        ],
        output_format: betaZodOutputFormat(ExtractionOutput),
      });
      if (message.stop_reason === "refusal") return { beliefs: [], listing: null };
      const parsed = message.parsed_output;
      if (!parsed) throw new Error("extraction: model returned no parsed output");
      return parsed;
    },
  };
}
