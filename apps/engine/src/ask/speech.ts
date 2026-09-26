/**
 * Text-to-speech for /ask answers. ElevenLabs synthesises; the bytes live in a small bounded
 * in-process store and are served back at GET /audio/:id, so no client ever holds the key.
 * docs/spec.md > Voice notes and updates.
 */
import { ulid } from "ulid";

export interface Speaker {
  /** Returns the relative URL the client fetches, matching the /image/:id convention. */
  speak(text: string): Promise<string>;
}

export interface AudioStore {
  put(bytes: Uint8Array, contentType: string): string;
  get(id: string): { bytes: Uint8Array; contentType: string } | undefined;
}

/** A demo answers a few dozen questions; keeping the last 32 clips is plenty and bounds memory. */
export const AUDIO_CAPACITY = 32;
const REQUEST_TIMEOUT_MS = 30_000;
const MAX_SPEECH_CHARS = 1_000;

export function createAudioStore(capacity = AUDIO_CAPACITY): AudioStore {
  const clips = new Map<string, { bytes: Uint8Array; contentType: string }>();
  return {
    put(bytes, contentType) {
      const id = ulid();
      clips.set(id, { bytes, contentType });
      // Map preserves insertion order, so the oldest key is the first one.
      while (clips.size > capacity) {
        const oldest = clips.keys().next();
        if (oldest.done) break;
        clips.delete(oldest.value);
      }
      return id;
    },
    get: (id) => clips.get(id),
  };
}

export interface ElevenLabsOptions {
  voiceId: string;
  store: AudioStore;
  model?: string;
  fetch?: typeof fetch;
}

export function createElevenLabsSpeaker(
  apiKey: string,
  options: ElevenLabsOptions,
): Speaker {
  const key = apiKey.trim();
  if (!key) throw new Error("ELEVENLABS_API_KEY must not be blank");
  const voiceId = options.voiceId.trim();
  if (!/^[A-Za-z0-9_-]+$/.test(voiceId))
    throw new Error("ELEVENLABS_VOICE_ID must be an opaque id");
  const model = options.model ?? "eleven_turbo_v2_5";
  const fetcher = options.fetch ?? globalThis.fetch;

  return {
    async speak(text) {
      const body = text.trim();
      if (!body) throw new Error("Nothing to speak");
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
      try {
        const response = await fetcher(
          `https://api.elevenlabs.io/v1/text-to-speech/${encodeURIComponent(voiceId)}`,
          {
            method: "POST",
            headers: {
              "xi-api-key": key,
              "Content-Type": "application/json",
              Accept: "audio/mpeg",
            },
            body: JSON.stringify({
              text: body.slice(0, MAX_SPEECH_CHARS),
              model_id: model,
            }),
            redirect: "error",
            signal: controller.signal,
          },
        );
        if (!response.ok)
          throw new Error(
            `Speech synthesis failed (HTTP ${response.status})`,
          );
        const bytes = new Uint8Array(await response.arrayBuffer());
        if (!bytes.byteLength) throw new Error("Speech synthesis returned no audio");
        const id = options.store.put(bytes, "audio/mpeg");
        return `/audio/${id}`;
      } finally {
        clearTimeout(timeout);
      }
    },
  };
}
