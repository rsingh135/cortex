/**
 * One-shot voice input for the pet: start streams the microphone to live transcription, stop
 * finishes the last words and resolves with the transcript. Extracted from the old composer so
 * the Talk button and the Option+V shortcut share it.
 */
import { useCallback, useEffect, useRef, useState } from "react";
import { streamSpeech, type VoicePhase } from "./realtime";

export interface VoiceInput {
  recording: boolean;
  finishing: boolean;
  phase: VoicePhase;
  /** Live transcript while recording. */
  partial: string;
  /** Start listening; resolves with the final transcript once stopped (empty when cancelled). */
  start(): Promise<string>;
  stop(): void;
}

export function useVoiceInput(onError: (message: string) => void): VoiceInput {
  const [recording, setRecording] = useState(false);
  const [finishing, setFinishing] = useState(false);
  const [phase, setPhase] = useState<VoicePhase>("connecting");
  const [partial, setPartial] = useState("");
  const active = useRef(false);
  const job = useRef<Promise<string> | null>(null);
  const mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      active.current = false;
    };
  }, []);

  const stop = useCallback(() => {
    active.current = false;
  }, []);

  const start = useCallback((): Promise<string> => {
    if (job.current) return job.current;
    active.current = true;
    setPhase("connecting");
    setRecording(true);
    setPartial("");
    let transcript = "";
    const run = (async () => {
      try {
        await streamSpeech(
          () => active.current,
          (text) => {
            transcript = text;
            if (mounted.current) setPartial(text);
          },
          (next) => {
            if (!mounted.current) return;
            setPhase(next);
            setFinishing(next === "finishing");
            setRecording(next !== "finishing");
          },
        );
      } catch (error) {
        if (mounted.current) onError(error instanceof Error ? error.message : String(error));
        transcript = "";
      } finally {
        active.current = false;
        job.current = null;
        if (mounted.current) {
          setRecording(false);
          setFinishing(false);
          setPartial("");
        }
      }
      return transcript.trim();
    })();
    job.current = run;
    return run;
  }, [onError]);

  return { recording, finishing, phase, partial, start, stop };
}
