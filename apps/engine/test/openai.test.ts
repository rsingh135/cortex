import { describe, expect, it } from "vitest";
import { z } from "zod";
import { openaiLlm, toResponsesInput, type OpenAiLike, type OpenAiParsedResponse } from "../src/ai/openai.js";
import { DEFAULT_MODELS, modelsFor, selectProvider } from "../src/ai/client.js";

const Out = z.object({ answer: z.string(), n: z.number().int() });

function fake(response: OpenAiParsedResponse): OpenAiLike & { calls: Record<string, unknown>[] } {
  const calls: Record<string, unknown>[] = [];
  return {
    calls,
    responses: {
      parse: async (params) => {
        calls.push(params);
        return response;
      },
    },
  };
}

describe("toResponsesInput", () => {
  it("maps text and base64 images to Responses input items", () => {
    const input = toResponsesInput([
      { role: "user", content: [{ type: "image", source: { type: "base64", media_type: "image/webp", data: "AAAA" } }, { type: "text", text: "what is here?" }] },
      { role: "assistant", content: "a listing" },
    ]);
    expect(input).toEqual([
      { role: "user", content: [{ type: "input_image", image_url: "data:image/webp;base64,AAAA", detail: "auto" }, { type: "input_text", text: "what is here?" }] },
      { role: "assistant", content: "a listing" },
    ]);
  });
});

describe("openaiLlm.parse", () => {
  it("sends instructions, input and a zod text format, and returns the parsed output", async () => {
    const client = fake({ output_parsed: { answer: "2800", n: 1 }, status: "completed", output: [] });
    const llm = openaiLlm(client);
    const r = await llm.parse({ model: "gpt-5.4-mini", system: "sys", messages: [{ role: "user", content: "budget?" }], schema: Out, maxTokens: 256 });
    expect(r).toEqual({ output: { answer: "2800", n: 1 }, stopReason: "completed" });
    const call = client.calls[0]!;
    expect(call["model"]).toBe("gpt-5.4-mini");
    expect(call["instructions"]).toBe("sys");
    expect(call["max_output_tokens"]).toBe(256);
    expect(call["input"]).toEqual([{ role: "user", content: "budget?" }]);
    const text = call["text"] as { format: { type: string; name: string; strict?: boolean } };
    expect(text.format.type).toBe("json_schema");
    expect(text.format.name).toBe("output");
  });

  it("reports refusals and incomplete responses as null output", async () => {
    const refused = openaiLlm(fake({ output: [{ type: "message", content: [{ type: "refusal", refusal: "no" }] }], status: "completed" }));
    expect(await refused.parse({ model: "m", system: "s", messages: [{ role: "user", content: "x" }], schema: Out })).toEqual({ output: null, stopReason: "refusal" });
    const cut = openaiLlm(fake({ status: "incomplete", incomplete_details: { reason: "max_output_tokens" }, output: [] }));
    expect((await cut.parse({ model: "m", system: "s", messages: [{ role: "user", content: "x" }], schema: Out })).stopReason).toBe("max_output_tokens");
  });

  it("rejects output that does not match the schema", async () => {
    const bad = openaiLlm(fake({ output_parsed: { answer: 1 }, status: "completed", output: [] }));
    expect((await bad.parse({ model: "m", system: "s", messages: [{ role: "user", content: "x" }], schema: Out })).output).toBeNull();
  });
});

describe("provider selection", () => {
  it("prefers Anthropic when its key is set, then OpenAI, then none", () => {
    expect(selectProvider({ OPENAI_API_KEY: "o", ANTHROPIC_API_KEY: "a" })).toBe("anthropic");
    expect(selectProvider({ OPENAI_API_KEY: "o" })).toBe("openai");
    expect(selectProvider({})).toBe("none");
  });
  it("honours LLM_PROVIDER and refuses a provider without its key", () => {
    expect(selectProvider({ LLM_PROVIDER: "openai", OPENAI_API_KEY: "o", ANTHROPIC_API_KEY: "a" })).toBe("openai");
    expect(selectProvider({ LLM_PROVIDER: "none", OPENAI_API_KEY: "o" })).toBe("none");
    expect(() => selectProvider({ LLM_PROVIDER: "openai" })).toThrow(/OPENAI_API_KEY/);
  });
  it("uses per-provider model defaults and env overrides", () => {
    expect(modelsFor("openai", {})).toEqual(DEFAULT_MODELS.openai);
    expect(modelsFor("openai", { OPENAI_ASK_MODEL: "gpt-5.5" }).ask).toBe("gpt-5.5");
    expect(modelsFor("anthropic", { EXTRACTION_MODEL: "claude-haiku-4-5" }).extraction).toBe("claude-haiku-4-5");
    expect(modelsFor("none", {})).toEqual(DEFAULT_MODELS.anthropic);
  });
});
