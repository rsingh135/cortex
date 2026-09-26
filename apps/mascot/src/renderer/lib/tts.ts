/** Plays the engine-provided answer audio. Resolves when playback ends or immediately when there is none. */
export function speak(audioUrl: string | undefined): Promise<void> {
  if (!audioUrl) return Promise.resolve();
  return new Promise((resolve) => {
    const audio = new Audio(audioUrl);
    audio.onended = () => resolve();
    audio.onerror = () => resolve();
    void audio.play().catch(() => resolve());
  });
}
