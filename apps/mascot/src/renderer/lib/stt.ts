/**
 * Speech-to-text for the user's voice. The mascot is the only place that needs an ElevenLabs key
 * on the client, and only for this. Answer audio comes back from the engine as `audio_url`.
 *
 * TODO(mascot track): wire ElevenLabs Scribe here.
 *   POST https://api.elevenlabs.io/v1/speech-to-text  (multipart: file=<blob>, model_id=scribe_v1)
 *   header xi-api-key: import.meta.env.VITE_ELEVENLABS_API_KEY
 *   response.text is the transcript.
 */
export class NotImplementedError extends Error {
  constructor(what: string) {
    super(`${what} is not implemented yet`);
    this.name = "NotImplementedError";
  }
}

export async function transcribe(_audio: Blob): Promise<string> {
  throw new NotImplementedError("ElevenLabs speech-to-text");
}

/** Records microphone audio while `active()` returns true; resolves with a webm blob. */
export async function recordWhile(active: () => boolean, pollMs = 100): Promise<Blob> {
  const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
  const recorder = new MediaRecorder(stream, { mimeType: "audio/webm" });
  const chunks: BlobPart[] = [];
  recorder.ondataavailable = (e) => chunks.push(e.data);
  recorder.start();
  await new Promise<void>((resolve) => {
    const tick = (): void => {
      if (!active()) resolve();
      else setTimeout(tick, pollMs);
    };
    tick();
  });
  const stopped = new Promise<void>((resolve) => (recorder.onstop = () => resolve()));
  recorder.stop();
  await stopped;
  stream.getTracks().forEach((t) => t.stop());
  return new Blob(chunks, { type: "audio/webm" });
}
