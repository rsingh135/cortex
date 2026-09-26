/**
 * Screenshot → beliefs with claude-sonnet-5 (vision, strict JSON via structured outputs).
 * Feed the L1 rung, not L0: cheaper and accurate enough (docs/spec.md > Belief extraction).
 */
import type { Llm } from "../ai/structured.js";
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

export const EMPTY_EXTRACTION: ExtractionOutput = { beliefs: [], listing: null };

export function createExtractor(llm: Llm, model = "claude-sonnet-5"): Extractor {
  return {
    async extract(input) {
      const result = await llm.parse({
        model,
        maxTokens: 4096,
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
        schema: ExtractionOutput,
      });
      // A refusal or an unparseable answer is treated as "nothing about Maya on this screen".
      return result.output ?? EMPTY_EXTRACTION;
    },
  };
}
