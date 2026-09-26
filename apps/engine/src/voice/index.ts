/**
 * Voice notes: ElevenLabs speech-to-text in; extraction with source voice and c0 0.9; a separate inference prompt (dog -> pets required, marked inferred); pinning; tombstone. ElevenLabs text-to-speech for the dream journal and /ask answers. docs/spec.md > Voice notes and updates.
 */
import { NotImplemented } from "../lib/errors.js";
import type { MemoryStore } from "../db/memory-store.js";

export interface VoiceModule {
  run(...args: unknown[]): Promise<never>;
}

export function createVoice(_store: MemoryStore): VoiceModule {
  return {
    async run() {
      throw new NotImplemented("voice");
    },
  };
}
