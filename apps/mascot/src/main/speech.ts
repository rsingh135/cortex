export const EMMA_VOICE_ID = "56bWURjYFHyYyVf490Dp";

/** Speech is synthesized server-side, always with the user-selected Emma voice. */
export async function synthesizeSpeech(text: string): Promise<Uint8Array> {
  if (typeof text !== "string" || !text.trim() || text.length > 5000) throw new Error("Speech requires between 1 and 5,000 characters.");
  const key = process.env.ELEVENLABS_API_KEY;
  if (!key) throw new Error("Set ELEVENLABS_API_KEY to hear Emma.");
  const response = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${EMMA_VOICE_ID}?output_format=mp3_44100_128`, {
    method: "POST", headers: { "xi-api-key": key, "content-type": "application/json", accept: "audio/mpeg" },
    body: JSON.stringify({ text: text.trim(), model_id: "eleven_multilingual_v2", voice_settings: { stability: 0.5, similarity_boost: 0.75 } }),
    signal: AbortSignal.timeout(60000),
  });
  if (response.status === 402) throw new Error("Cortex’s Emma voice requires a paid ElevenLabs plan (402). Library voices are unavailable on the free API plan.");
  if (!response.ok) throw new Error(`Emma’s voice is unavailable (${response.status}). Check Text to Speech permission, voice access, and ElevenLabs credits.`);
  const bytes = new Uint8Array(await response.arrayBuffer());
  if (!bytes.length) throw new Error("ElevenLabs returned empty speech audio.");
  return bytes;
}
