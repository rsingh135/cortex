export type VoicePhase = "connecting" | "listening" | "finishing";

export class LiveTranscript {
  private committed: string[] = [];
  private partial = "";
  update(type: string, text: string): string {
    if (type === "committed_transcript") { if (text.trim()) this.committed.push(text.trim()); this.partial = ""; }
    if (type === "partial_transcript") this.partial = text.trim();
    return [...this.committed, this.partial].filter(Boolean).join(" ");
  }
}

/** Stream microphone PCM to Scribe. Text updates arrive before the user stops recording. */
export async function streamSpeech(active: () => boolean, onText: (text: string) => void, onPhase: (phase: VoicePhase) => void): Promise<void> {
  if (!navigator.mediaDevices?.getUserMedia || typeof AudioContext === "undefined") throw new Error("Live voice needs microphone access. Open Cortex in Chrome or the desktop app.");
  const context = new AudioContext({ sampleRate: 16000 });
  // Resume within the click gesture, before token/network work.
  const resumed = context.resume();
  let stream: MediaStream | undefined;
  let socket: WebSocket | undefined;
  let worklet: AudioWorkletNode | undefined;
  let source: MediaStreamAudioSourceNode | undefined;
  let muted: GainNode | undefined;
  let interval: ReturnType<typeof setInterval> | undefined;
  let deadline: ReturnType<typeof setTimeout> | undefined;
  let finalDeadline: ReturnType<typeof setTimeout> | undefined;
  let finish: (() => void) | undefined;
  let fail: ((error: Error) => void) | undefined;
  let stopping = false;
  let capturing = false;
  let liveText = "";
  let cancelInterval: ReturnType<typeof setInterval> | undefined;
  const transcript = new LiveTranscript();
  try {
    onPhase("connecting");
    await resumed;
    if (!context.audioWorklet) throw new Error("Live voice is unavailable in this browser. Try Chrome or the desktop app.");
    stream = await navigator.mediaDevices.getUserMedia({ audio: { channelCount: 1, echoCancellation: true, noiseSuppression: true } });
    cancelInterval = setInterval(() => {
      if (!active() && !capturing) { stream?.getTracks().forEach((track) => track.stop()); finish?.(); }
    }, 100);
    if (!active()) return;
    const token = await window.mascot.realtimeToken();
    if (!active()) return;
    await context.audioWorklet.addModule(new URL("./pcm-worklet.js", document.baseURI).href);
    if (!active()) return;
    const url = new URL("wss://api.elevenlabs.io/v1/speech-to-text/realtime");
    url.search = new URLSearchParams({ token, model_id: "scribe_v2_realtime", audio_format: "pcm_16000", commit_strategy: "manual" }).toString();
    socket = new WebSocket(url);
    const ws = socket;
    const send = (bytes: ArrayBuffer, commit = false) => {
      if (ws.readyState !== WebSocket.OPEN) return;
      if (ws.bufferedAmount > 1024 * 1024) { fail?.(new Error("The voice connection is too slow. Your text is preserved; please try again.")); return; }
      const base64 = btoa(String.fromCharCode(...new Uint8Array(bytes)));
      ws.send(JSON.stringify({ message_type: "input_audio_chunk", audio_base_64: base64, sample_rate: 16000, commit }));
    };
    await new Promise<void>((resolve, reject) => {
      finish = resolve; fail = reject;
      deadline = setTimeout(() => reject(new Error("Live transcription did not connect. Please try again.")), 15000);
      ws.onmessage = (event) => {
        let message: { message_type?: string; text?: string; error?: string };
        try { message = JSON.parse(String(event.data)); } catch { return; }
        const type = message.message_type ?? "";
        if (type === "session_started") {
          clearTimeout(deadline);
          if (!active()) { resolve(); return; }
          try {
            source = context.createMediaStreamSource(stream!);
            worklet = new AudioWorkletNode(context, "cortex-pcm");
            muted = context.createGain(); muted.gain.value = 0;
            worklet.port.onmessage = ({ data }: MessageEvent<{ bytes?: ArrayBuffer; flushed?: boolean }>) => {
              if (data.bytes) send(data.bytes);
              if (data.flushed) {
                // Final silence plus explicit commit flushes the last words.
                send(new ArrayBuffer(8000), true);
                finalDeadline = setTimeout(() => reject(new Error("The final words could not be confirmed. Your live transcript is preserved for review.")), 8000);
              }
            };
            source.connect(worklet); worklet.connect(muted); muted.connect(context.destination);
            capturing = true;
            onPhase("listening");
            const started = Date.now();
            interval = setInterval(() => {
              if (active() && Date.now() - started < 60000) return;
              if (stopping) return;
              stopping = true;
              onPhase("finishing");
              source?.disconnect(); stream?.getTracks().forEach((track) => track.stop());
              worklet?.port.postMessage("flush");
            }, 100);
          } catch (error) { reject(error); }
        } else if (type === "partial_transcript" || type === "committed_transcript") {
          liveText = transcript.update(type, message.text ?? "");
          onText(liveText);
          if (stopping && type === "committed_transcript") resolve();
        } else if (message.error || type.endsWith("_error") || ["auth_error", "quota_exceeded", "rate_limited"].includes(type)) {
          reject(new Error(message.error ?? `Live transcription failed (${type}). Check ElevenLabs permissions and credits.`));
        }
      };
      ws.onerror = () => reject(new Error("Could not connect to ElevenLabs live transcription. Please try again."));
      ws.onclose = () => reject(new Error("The voice connection closed. Your live text is preserved."));
    });
    if (capturing && !liveText.trim()) throw new Error("No speech detected. Please try speaking a little closer to your microphone.");
  } catch (error) {
    if (error instanceof Error && error.name === "NotAllowedError") throw new Error("Microphone access is blocked. Allow microphone access in your browser and macOS Privacy & Security settings.");
    if (error instanceof Error && error.name === "NotFoundError") throw new Error("No microphone found. Connect a microphone and try again.");
    throw error;
  } finally {
    clearInterval(cancelInterval); clearInterval(interval); clearTimeout(deadline); clearTimeout(finalDeadline);
    source?.disconnect(); worklet?.disconnect(); muted?.disconnect();
    if (worklet) worklet.port.onmessage = null;
    stream?.getTracks().forEach((track) => track.stop());
    if (socket) { socket.onmessage = null; socket.onclose = null; socket.onerror = null; socket.close(); }
    if (context.state !== "closed") await context.close();
    finish = undefined; fail = undefined;
  }
}
