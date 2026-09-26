/**
 * Embeddings via Voyage AI voyage-3-lite (512 dims). Stored as int8 BinData to keep belief docs small
 * and excluded from byte accounting in every condition. docs/spec.md > Data model.
 */
export const EMBEDDING_DIMS = 512;
export const EMBEDDING_MODEL = "voyage-3-lite";
const REQUEST_TIMEOUT_MS = 30_000;

export interface Embedder {
  embed(texts: string[]): Promise<Float32Array[]>;
}

export interface VoyageEmbedderOptions {
  /** API root including /v1; Atlas model keys use ai.mongodb.com. */
  baseUrl?: string;
  /** Must produce 512-dimensional vectors compatible with the stored corpus. */
  model?: string;
  fetch?: typeof fetch;
}

export function createVoyageEmbedder(apiKey: string | undefined, options: VoyageEmbedderOptions = {}): Embedder {
  const key = apiKey?.trim();
  const baseUrl = options.baseUrl ?? (key?.startsWith("al-") ? "https://ai.mongodb.com/v1" : "https://api.voyageai.com/v1");
  let endpoint: URL;
  try {
    endpoint = new URL(baseUrl);
    if (endpoint.protocol !== "https:" || endpoint.username || endpoint.password || endpoint.search || endpoint.hash) throw new Error();
    endpoint.pathname = `${endpoint.pathname.replace(/\/+$/, "")}/embeddings`;
  } catch {
    throw new Error("Embedding API base URL must be HTTPS without credentials, query, or fragment");
  }
  const model = options.model?.trim() ?? EMBEDDING_MODEL;
  if (!model) throw new Error("Embedding model must not be blank");
  const fetcher = options.fetch ?? globalThis.fetch;

  return {
    async embed(texts) {
      if (texts.length === 0) return [];
      if (!key) throw new Error("VOYAGE_API_KEY is required for embeddings");
      if (texts.length > 1000 || texts.some(text => typeof text !== "string" || !text.trim())) {
        throw new Error("Embedding input must contain at most 1000 nonblank strings");
      }
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
      try {
        let response: Response;
        try {
          response = await fetcher(endpoint, {
            method: "POST",
            headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
            body: JSON.stringify({
              model,
              input: texts,
              // voyage-3-lite has a fixed 512-dimensional output; newer models require this override.
              ...(model === EMBEDDING_MODEL ? {} : { output_dimension: EMBEDDING_DIMS }),
              output_dtype: "float",
              encoding_format: null,
              truncation: false,
            }),
            redirect: "error",
            signal: controller.signal,
          });
        } catch {
          throw new Error(controller.signal.aborted ? "Embedding request timed out" : "Embedding request failed");
        }
        if (!response.ok) throw new Error(`Embedding API request failed (HTTP ${response.status})`);
        let payload: unknown;
        try {
          payload = await response.json();
        } catch {
          throw new Error(controller.signal.aborted ? "Embedding request timed out" : "Embedding API returned invalid JSON");
        }
        return parseEmbeddings(payload, texts.length);
      } finally {
        clearTimeout(timeout);
      }
    },
  };
}

function parseEmbeddings(payload: unknown, count: number): Float32Array[] {
  const invalid = () => new Error("Embedding API returned invalid embeddings");
  if (!payload || typeof payload !== "object" || !("data" in payload) || !Array.isArray(payload.data) || payload.data.length !== count) {
    throw invalid();
  }
  const vectors = new Array<Float32Array>(count);
  for (const row of payload.data) {
    if (!row || typeof row !== "object") throw invalid();
    const { index, embedding } = row as { index?: unknown; embedding?: unknown };
    if (typeof index !== "number" || !Number.isInteger(index) || index < 0 || index >= count || vectors[index]) throw invalid();
    if (!Array.isArray(embedding) || embedding.length !== EMBEDDING_DIMS) throw invalid();
    for (const value of embedding) {
      if (typeof value !== "number" || !Number.isFinite(value) || !Number.isFinite(Math.fround(value))) throw invalid();
    }
    vectors[index] = Float32Array.from(embedding);
  }
  return vectors;
}

/** Symmetric int8 quantisation; scale = max(|x|)/127. Returns the bytes and the scale needed to decode. */
export function packInt8(vec: Float32Array | number[]): { data: Int8Array; scale: number } {
  let max = 0;
  for (const v of vec) max = Math.max(max, Math.abs(v));
  const scale = max === 0 ? 1 : max / 127;
  const data = new Int8Array(vec.length);
  for (let i = 0; i < vec.length; i++) data[i] = Math.round((vec[i] ?? 0) / scale);
  return { data, scale };
}

export function unpackInt8(data: Int8Array, scale: number): Float32Array {
  const out = new Float32Array(data.length);
  for (let i = 0; i < data.length; i++) out[i] = (data[i] ?? 0) * scale;
  return out;
}

export function cosine(a: ArrayLike<number>, b: ArrayLike<number>): number {
  let dot = 0;
  let na = 0;
  let nb = 0;
  for (let i = 0; i < a.length; i++) {
    const x = a[i] ?? 0;
    const y = b[i] ?? 0;
    dot += x * y;
    na += x * x;
    nb += y * y;
  }
  return na && nb ? dot / Math.sqrt(na * nb) : 0;
}
