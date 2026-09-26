/**
 * ElevenLabs text-to-speech for spoken answers. Library voices are rejected on the free plan via
 * the API (402); on that response we retry with a premade voice (issue #3).
 */
import { newId } from "../lib/ids.js";

export const PREMADE_VOICE = "EXAVITQu4vr4xnSDxMaL";
const MAX_STORED = 50;

export interface Tts {
  synthesize(text: string): Promise<string | null>;
}

export interface AudioStore {
  put(bytes: Uint8Array): string;
  get(id: string): Uint8Array | undefined;
}

export function createAudioStore(): AudioStore {
  const entries = new Map<string, Uint8Array>();
  return {
    put(bytes) {
      const id = newId();
      entries.set(id, bytes);
      while (entries.size > MAX_STORED) {
        const oldest = entries.keys().next().value;
        if (oldest === undefined) break;
        entries.delete(oldest);
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

/** Returns the stored audio id, or null when TTS is unavailable. Never throws into the ask path. */
export function createTts(opts: TtsOptions): Tts {
  const fetchFn = opts.fetchFn ?? fetch;
  const modelId = opts.modelId ?? "eleven_multilingual_v2";
  const call = async (voice: string, text: string): Promise<Response> =>
    fetchFn(`https://api.elevenlabs.io/v1/text-to-speech/${encodeURIComponent(voice)}?output_format=mp3_44100_128`, {
      method: "POST",
      headers: { "xi-api-key": opts.apiKey ?? "", "content-type": "application/json" },
      body: JSON.stringify({ text, model_id: modelId }),
    });
  return {
    async synthesize(text) {
      if (!opts.apiKey || !text.trim()) return null;
      try {
        let res = await call(opts.voiceId, text);
        if (res.status === 402 && opts.voiceId !== PREMADE_VOICE) res = await call(PREMADE_VOICE, text);
        if (!res.ok) return null;
        return opts.store.put(new Uint8Array(await res.arrayBuffer()));
      } catch {
        return null;
      }
    },
  };
}
