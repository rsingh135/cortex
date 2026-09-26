/**
 * Embeddings via Voyage AI voyage-3-lite (512 dims). Stored as int8 BinData to keep belief docs small
 * and excluded from byte accounting in every condition. docs/spec.md > Data model.
 */
import { NotImplemented } from "../lib/errors.js";

export const EMBEDDING_DIMS = 512;
export const EMBEDDING_MODEL = "voyage-3-lite";

export interface Embedder {
  embed(texts: string[]): Promise<Float32Array[]>;
}

export function createVoyageEmbedder(apiKey: string | undefined): Embedder {
  return {
    async embed() {
      if (!apiKey) throw new NotImplemented("recall/embed", "VOYAGE_API_KEY unset");
      // POST https://api.voyageai.com/v1/embeddings {model, input, output_dimension: 512}
      throw new NotImplemented("recall/embed");
    },
  };
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
