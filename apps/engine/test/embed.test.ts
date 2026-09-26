import { afterEach, describe, expect, it, vi } from "vitest";
import { createVoyageEmbedder, EMBEDDING_DIMS, EMBEDDING_MODEL } from "../src/recall/embed.js";

const vector = (value = 0.25) => Array<number>(EMBEDDING_DIMS).fill(value);
const row = (index = 0, embedding: unknown = vector()) => ({ index, embedding });
const reply = (data: unknown) => new Response(JSON.stringify(data), { headers: { "Content-Type": "application/json" } });

afterEach(() => vi.useRealTimers());

describe("Voyage embeddings", () => {
  it("uses Atlas for model keys, restores input order, and requests float vectors without redirects", async () => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(reply({ data: [row(1, vector(0.5)), row(0)] }));
    const embedder = createVoyageEmbedder("al-test-key", { model: "voyage-4-lite", fetch: fetcher });
    const embeddings = await embedder.embed(["first", "second"]);
    expect(embeddings).toHaveLength(2);
    expect(embeddings[0]).toBeInstanceOf(Float32Array);
    expect(embeddings[0]![0]).toBe(0.25);
    expect(embeddings[1]![0]).toBe(0.5);
    const [url, options] = fetcher.mock.calls[0]!;
    expect(String(url)).toBe("https://ai.mongodb.com/v1/embeddings");
    expect(options).toMatchObject({ method: "POST", redirect: "error", headers: { Authorization: "Bearer al-test-key" } });
    expect(options?.signal).toBeInstanceOf(AbortSignal);
    expect(JSON.parse(String(options?.body))).toEqual({
      model: "voyage-4-lite", input: ["first", "second"], output_dimension: 512,
      output_dtype: "float", encoding_format: null, truncation: false,
    });
  });

  it("preserves the legacy provider and fixed-dimension model defaults", async () => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(reply({ data: [row()] }));
    await createVoyageEmbedder("pa-test-key", { fetch: fetcher }).embed(["text"]);
    const [url, options] = fetcher.mock.calls[0]!;
    expect(String(url)).toBe("https://api.voyageai.com/v1/embeddings");
    const body = JSON.parse(String(options?.body));
    expect(body.model).toBe(EMBEDDING_MODEL);
    expect(body).not.toHaveProperty("output_dimension");
  });

  it("supports a configured HTTPS endpoint", async () => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(reply({ data: [row()] }));
    await createVoyageEmbedder("al-test-key", { baseUrl: "https://us.ai.mongodb.com/v1/", fetch: fetcher }).embed(["text"]);
    expect(String(fetcher.mock.calls[0]![0])).toBe("https://us.ai.mongodb.com/v1/embeddings");
  });

  it.each([
    "http://ai.mongodb.com/v1", "https://user:secret@ai.mongodb.com/v1",
    "https://ai.mongodb.com/v1?key=secret", "https://ai.mongodb.com/v1#secret", "not a URL",
  ])("rejects an unsafe or malformed base URL (%s)", baseUrl => {
    expect(() => createVoyageEmbedder("al-test-key", { baseUrl })).toThrow("Embedding API base URL must be HTTPS");
  });

  it("does not make requests for empty batches, absent credentials, or invalid inputs", async () => {
    const fetcher = vi.fn<typeof fetch>();
    const embedder = createVoyageEmbedder(undefined, { fetch: fetcher });
    await expect(embedder.embed([])).resolves.toEqual([]);
    await expect(embedder.embed(["text"])).rejects.toThrow("VOYAGE_API_KEY is required");
    const keyed = createVoyageEmbedder("al-test-key", { fetch: fetcher });
    await expect(keyed.embed([" "])).rejects.toThrow("nonblank strings");
    await expect(keyed.embed(Array<string>(1001).fill("text"))).rejects.toThrow("at most 1000");
    expect(fetcher).not.toHaveBeenCalled();
  });

  it.each([
    { data: [] }, { data: [row(), row()] }, { data: [row(1)] }, { data: [row(-1)] }, { data: [row(0.5)] },
    { data: [row(0, [1, 2])] }, { data: [row(0, "base64")] },
    { data: [row(0, ["0.25", ...vector().slice(1)])] },
    { data: [row(0, [null, ...vector().slice(1)])] },
    { data: [row(0, [1e100, ...vector().slice(1)])] },
    { data: [null] }, { data: "unexpected" }, {}, null,
  ])("rejects malformed vectors, dimensions, indexes, and counts", async payload => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(reply(payload));
    await expect(createVoyageEmbedder("al-test-key", { fetch: fetcher }).embed(["text"])).rejects.toThrow("invalid embeddings");
  });

  it("rejects duplicate indexes even when the response count matches", async () => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(reply({ data: [row(), row()] }));
    await expect(createVoyageEmbedder("al-test-key", { fetch: fetcher }).embed(["one", "two"])).rejects.toThrow("invalid embeddings");
  });

  it("reports API status without exposing the response body or status text", async () => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(new Response("al-secret echoed by provider", { status: 401, statusText: "al-secret" }));
    await expect(createVoyageEmbedder("al-test-key", { fetch: fetcher }).embed(["text"])).rejects.toThrow(/^Embedding API request failed \(HTTP 401\)$/);
  });

  it("redacts network failures and rejects non-JSON success responses", async () => {
    const fetcher = vi.fn<typeof fetch>().mockRejectedValueOnce(new Error("al-secret network error"))
      .mockResolvedValueOnce(new Response("al-secret invalid JSON"));
    const embedder = createVoyageEmbedder("al-test-key", { fetch: fetcher });
    await expect(embedder.embed(["text"])).rejects.toThrow(/^Embedding request failed$/);
    await expect(embedder.embed(["text"])).rejects.toThrow(/^Embedding API returned invalid JSON$/);
  });

  it("aborts slow requests after 30 seconds", async () => {
    vi.useFakeTimers();
    const fetcher = vi.fn<typeof fetch>().mockImplementation((_url, options) => new Promise((_resolve, reject) => {
      options?.signal?.addEventListener("abort", () => reject(new Error("al-secret abort detail")), { once: true });
    }));
    const pending = createVoyageEmbedder("al-test-key", { fetch: fetcher }).embed(["text"]);
    const assertion = expect(pending).rejects.toThrow(/^Embedding request timed out$/);
    await vi.advanceTimersByTimeAsync(30_000);
    await assertion;
    expect(fetcher.mock.calls[0]![1]?.signal?.aborted).toBe(true);
  });
});
