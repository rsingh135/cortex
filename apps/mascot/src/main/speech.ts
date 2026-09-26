export const EMMA_VOICE_ID = "56bWURjYFHyYyVf490Dp";
/** Premade "Sarah": available on every plan, so the pet still has a voice on the free tier. */
export const FALLBACK_VOICE_ID = "EXAVITQu4vr4xnSDxMaL";

function request(voice: string, key: string, text: string): Promise<Response> {
  return fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voice}?output_format=mp3_44100_128`, {
    method: "POST", headers: { "xi-api-key": key, "content-type": "application/json", accept: "audio/mpeg" },
    body: JSON.stringify({ text: text.trim(), model_id: "eleven_multilingual_v2", voice_settings: { stability: 0.5, similarity_boost: 0.75 } }),
    signal: AbortSignal.timeout(60000),
  });
}

/**
 * Speech is synthesized server-side. Emma is a library voice, which the API refuses on the free plan
 * with 402 paid_plan_required, so a 402 retries once with a premade voice rather than leaving the pet
 * mute. ELEVENLABS_VOICE_ID overrides the first choice.
 */
export async function synthesizeSpeech(text: string): Promise<Uint8Array> {
  if (typeof text !== "string" || !text.trim() || text.length > 5000) throw new Error("Speech requires between 1 and 5,000 characters.");
  const key = process.env.ELEVENLABS_API_KEY;
  if (!key) throw new Error("Set ELEVENLABS_API_KEY to hear Cortex speak.");
  const preferred = process.env.ELEVENLABS_VOICE_ID?.trim() || EMMA_VOICE_ID;
  let response = await request(preferred, key, text);
  if (response.status === 402 && preferred !== FALLBACK_VOICE_ID)
    response = await request(FALLBACK_VOICE_ID, key, text);
  if (response.status === 402)
    throw new Error("This ElevenLabs plan cannot synthesize speech (402). Library voices need a paid plan.");
  if (!response.ok) throw new Error(`Cortex’s voice is unavailable (${response.status}). Check Text to Speech permission, voice access, and ElevenLabs credits.`);
  const bytes = new Uint8Array(await response.arrayBuffer());
  if (!bytes.length) throw new Error("ElevenLabs returned empty speech audio.");
  return bytes;
}
