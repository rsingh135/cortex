let context: AudioContext | undefined;
let source: AudioBufferSourceNode | undefined;
let finishPlayback: (() => void) | undefined;
let generation = 0;

/** Called directly from the voice-toggle click so browsers allow later audio playback. */
export async function unlockSpeech(): Promise<void> {
  context ??= new AudioContext();
  await context.resume();
}
export function stopSpeech(): void {
  generation++;
  source?.stop(); source?.disconnect(); source = undefined;
  finishPlayback?.(); finishPlayback = undefined;
}
export async function speakText(text: string): Promise<void> {
  stopSpeech();
  const current = generation;
  const bytes = await window.mascot.synthesize(text);
  if (current !== generation) return;
  if (!context) throw new Error("Enable Talk with Emma to hear spoken replies.");
  await context.resume();
  const decoded = await context.decodeAudioData(new Uint8Array(bytes).buffer);
  if (current !== generation) return;
  const audio = context.createBufferSource();
  audio.buffer = decoded; audio.connect(context.destination); source = audio;
  await new Promise<void>((resolve) => {
    finishPlayback = resolve;
    audio.onended = () => {
      audio.disconnect();
      if (source === audio) { source = undefined; finishPlayback = undefined; }
      resolve();
    };
    audio.start();
  });
}
