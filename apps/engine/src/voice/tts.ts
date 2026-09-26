/**
 * ElevenLabs text-to-speech for spoken answers. docs/spec.md > Voice notes and updates.
 *
 * Synthesised clips live in a small bounded in-process store and are served back at
 * GET /audio/:id, so no client ever holds the key.
 *
 * Library voices are rejected on the free plan via the API with 402 paid_plan_required, so a 402
 * retries once with a premade voice rather than failing the answer. Nothing here throws into the
 * ask path either: a silent reply beats no reply.
 */
import { newId } from "../lib/ids.js";

/** Premade "Sarah". Available on every plan; docs/spec.md resolved the dream-journal voice to this. */
export const PREMADE_VOICE = "EXAVITQu4vr4xnSDxMaL";
/** A demo answers a few dozen questions; keeping the last 50 clips bounds memory. */
export const AUDIO_CAPACITY = 50;
const REQUEST_TIMEOUT_MS = 30_000;
const MAX_SPEECH_CHARS = 1_000;
/** Every clip comes back as MP3, because the request asks for mp3_44100_128. */
export const AUDIO_CONTENT_TYPE = "audio/mpeg";

export interface Tts {
  /** The stored clip id, or null when speech is unavailable. Never rejects. */
  synthesize(text: string): Promise<string | null>;
}

export interface AudioStore {
  put(bytes: Uint8Array): string;
  get(id: string): Uint8Array | undefined;
}

export function createAudioStore(capacity = AUDIO_CAPACITY): AudioStore {
  const entries = new Map<string, Uint8Array>();
  return {
    put(bytes) {
      const id = newId();
      entries.set(id, bytes);
      // Map preserves insertion order, so the first key is the oldest clip.
      while (entries.size > capacity) {
        const oldest = entries.keys().next();
        if (oldest.done) break;
        entries.delete(oldest.value);
      }
      return id;
    },
    get: (id) => entries.get(id),
  };
}

export interface TtsOptions {
  apiKey: string | undefined;
  voiceId: string;
  store: AudioStore;
  fetchFn?: typeof fetch;
  modelId?: string;
}

export function createTts(opts: TtsOptions): Tts {
  const fetchFn = opts.fetchFn ?? fetch;
  const modelId = opts.modelId ?? "eleven_multilingual_v2";
  // An opaque id keeps a stray value out of the request path.
  const safeVoice = /^[A-Za-z0-9_-]+$/.test(opts.voiceId)
    ? opts.voiceId
    : PREMADE_VOICE;

  const call = (voice: string, text: string, signal: AbortSignal) =>
    fetchFn(
      `https://api.elevenlabs.io/v1/text-to-speech/${encodeURIComponent(voice)}?output_format=mp3_44100_128`,
      {
        method: "POST",
        headers: {
          "xi-api-key": opts.apiKey ?? "",
          "content-type": "application/json",
        },
        body: JSON.stringify({
          text: text.slice(0, MAX_SPEECH_CHARS),
          model_id: modelId,
        }),
        redirect: "error",
        signal,
      },
    );

  return {
    async synthesize(text) {
      if (!opts.apiKey || !text.trim()) return null;
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
      try {
        let response = await call(safeVoice, text, controller.signal);
        if (response.status === 402 && safeVoice !== PREMADE_VOICE)
          response = await call(PREMADE_VOICE, text, controller.signal);
        if (!response.ok) return null;
        const bytes = new Uint8Array(await response.arrayBuffer());
        return bytes.byteLength ? opts.store.put(bytes) : null;
      } catch {
        return null;
      } finally {
        clearTimeout(timeout);
      }
    },
  };
}
