/** The ElevenLabs credential stays in Electron main, never in renderer assets. */
export async function transcribeAudio(bytes: Uint8Array, mime: string): Promise<string> {
  const key = process.env.ELEVENLABS_API_KEY;
  if (!key) throw new Error("Set ELEVENLABS_API_KEY in your .env file to enable voice input.");
  if (!(bytes instanceof Uint8Array) || !bytes.byteLength || bytes.byteLength > 20 * 1024 * 1024) {
    throw new Error("Recording must be between 1 byte and 20 MB.");
  }
  if (!/^audio\/(webm|ogg|mp4|wav|mpeg)(;.*)?$/.test(mime)) throw new Error("Unsupported recording format.");
  const form = new FormData();
  const extension = mime.includes("mp4") ? "m4a" : mime.includes("ogg") ? "ogg" : mime.includes("wav") ? "wav" : mime.includes("mpeg") ? "mp3" : "webm";
  form.append("file", new Blob([new Uint8Array(bytes)], { type: mime }), `memory.${extension}`);
  form.append("model_id", "scribe_v2");
  form.append("tag_audio_events", "false");
  const response = await fetch("https://api.elevenlabs.io/v1/speech-to-text", {
    method: "POST", headers: { "xi-api-key": key }, body: form, signal: AbortSignal.timeout(60000),
  });
  if (!response.ok) throw new Error(`ElevenLabs transcription failed (${response.status}). Check your API key and quota.`);
  const data = await response.json() as { text?: unknown };
  if (typeof data.text !== "string" || !data.text.trim()) throw new Error("No speech detected. Try another recording.");
  return data.text.trim();
}

/** Browser receives only a short-lived, single-use Scribe token, never the API key. */
export async function createRealtimeToken(): Promise<string> {
  const key = process.env.ELEVENLABS_API_KEY;
  if (!key) throw new Error("Set ELEVENLABS_API_KEY to enable live transcription.");
  const response = await fetch("https://api.elevenlabs.io/v1/single-use-token/realtime_scribe", {
    method: "POST", headers: { "xi-api-key": key }, signal: AbortSignal.timeout(15000),
  });
  if (!response.ok) throw new Error(`ElevenLabs could not start live transcription (${response.status}). Check Speech to Text permissions and credits.`);
  const result = await response.json() as { token?: unknown };
  if (typeof result.token !== "string" || !result.token) throw new Error("ElevenLabs returned no live-session token.");
  return result.token;
}
