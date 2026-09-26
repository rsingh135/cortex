export async function transcribe(audio: Blob): Promise<string> {
  if (!audio.size) throw new Error("The recording was empty. Record a little longer and try again.");
  return window.mascot.transcribe(new Uint8Array(await audio.arrayBuffer()), audio.type);
}

/** Always release the microphone, including permission races and recorder failures. */
export async function recordWhile(active: () => boolean): Promise<Blob> {
  if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === "undefined") {
    throw new Error("This browser cannot record audio. Open Cortex in Chrome or the desktop app.");
  }
  let stream: MediaStream;
  try { stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true } }); }
  catch (error) {
    const name = error instanceof Error ? error.name : "";
    if (name === "NotAllowedError" || name === "SecurityError") throw new Error("Microphone access is blocked. Allow the microphone in your browser and macOS Privacy & Security settings, then try again.");
    if (name === "NotFoundError") throw new Error("No microphone found. Connect a microphone and try again.");
    if (name === "NotReadableError") throw new Error("Your microphone is busy or unavailable. Close other recording apps and try again.");
    throw error;
  }
  let timer: ReturnType<typeof setInterval> | undefined;
  try {
    if (!active()) throw new Error("Recording cancelled.");
    const mimeType = ["audio/webm;codecs=opus", "audio/webm", "audio/mp4"].find((type) => MediaRecorder.isTypeSupported(type));
    const recorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
    const chunks: BlobPart[] = [];
    const started = Date.now();
    return await new Promise<Blob>((resolve, reject) => {
      recorder.ondataavailable = (event) => { if (event.data.size) chunks.push(event.data); };
      recorder.onerror = () => reject(new Error("Microphone recording failed. Please try again."));
      recorder.onstop = () => {
        const audio = new Blob(chunks, { type: recorder.mimeType || mimeType || "audio/webm" });
        if (!audio.size) reject(new Error("The recording was empty. Record a little longer and try again."));
        else resolve(audio);
      };
      recorder.start(200);
      timer = setInterval(() => {
        if ((!active() || Date.now() - started >= 60000) && recorder.state === "recording") recorder.stop();
      }, 100);
    });
  } finally {
    clearInterval(timer);
    stream.getTracks().forEach((track) => track.stop());
  }
}
