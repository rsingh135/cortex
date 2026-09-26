/**
 * The pet, Codex-style: the portrait with two mini buttons underneath (Talk, Type). No panel.
 * Talk streams the microphone, stops on a second press, and sends the transcript to the engine;
 * Type shows a one-line field. Answers appear in a small bubble above the pet and are spoken.
 * Dragging is native (`-webkit-app-region: drag` on the portrait), so the window follows the
 * cursor at the OS frame rate wherever it is on screen.
 */
import { useCallback, useEffect, useRef, useState, type FormEvent } from "react";
import { Bubble } from "./components/Bubble";
import { KeyboardIcon, MicIcon, SendIcon, StopIcon } from "./components/Icons";
import { Pet } from "./components/Pet";
import { useMascotStore } from "./lib/store";
import { speakText, stopSpeech, unlockSpeech } from "./lib/tts";
import { useVoiceInput } from "./lib/voice";

const BUBBLE_MS = 14_000;

export function App() {
  const { pet, reaction, lastAnswer, error, dispatch } = useMascotStore();
  const [typing, setTyping] = useState(false);
  const [draft, setDraft] = useState("");
  const [showBubble, setShowBubble] = useState(false);
  const input = useRef<HTMLInputElement>(null);
  const fail = useCallback((message: string) => dispatch({ type: "failed", message }), [dispatch]);
  const voice = useVoiceInput(fail);
  const busy = pet === "thinking" || pet === "speaking";

  useEffect(() => () => stopSpeech(), []);
  useEffect(() => {
    if (!window.mascot) return;
    return window.mascot.onEvent((event) => dispatch({ type: "engineEvent", event }));
  }, [dispatch]);
  useEffect(() => {
    if (pet !== "reacting") return;
    const timer = setTimeout(() => dispatch({ type: "reactionDone" }), 800);
    return () => clearTimeout(timer);
  }, [pet, dispatch]);
  useEffect(() => {
    if (!lastAnswer && !error) return;
    setShowBubble(true);
    const timer = setTimeout(() => setShowBubble(false), BUBBLE_MS);
    return () => clearTimeout(timer);
  }, [lastAnswer, error]);
  useEffect(() => {
    // Click-through everywhere except the pet; only tell main when the answer changes.
    let last: boolean | null = null;
    const set = (through: boolean) => {
      if (through === last) return;
      last = through;
      window.mascot?.setClickThrough(through);
    };
    const move = (event: MouseEvent) => set(!(event.target as Element).closest?.("[data-interactive]"));
    const leave = () => set(true);
    document.addEventListener("mousemove", move);
    document.addEventListener("mouseleave", leave);
    return () => {
      document.removeEventListener("mousemove", move);
      document.removeEventListener("mouseleave", leave);
    };
  }, []);

  const ask = useCallback(
    async (text: string) => {
      const question = text.trim();
      if (!question) return;
      setTyping(false);
      setDraft("");
      if (!window.mascot) {
        fail("Open the desktop app to talk to Cortex.");
        return;
      }
      dispatch({ type: "asked", text: question });
      try {
        const response = await window.mascot.ask(question, { speak: false });
        dispatch({ type: "answered", response });
        try {
          await unlockSpeech();
          await speakText(response.answer);
        } catch {
          // The spoken reply is best effort; the bubble already shows the text.
        }
        dispatch({ type: "doneSpeaking" });
      } catch (err) {
        fail(err instanceof Error ? err.message : "My memory engine isn't reachable yet.");
      }
    },
    [dispatch, fail],
  );

  const talk = useCallback(async () => {
    if (voice.recording) {
      voice.stop();
      return;
    }
    if (busy) return;
    stopSpeech();
    setTyping(false);
    void unlockSpeech().catch(() => undefined);
    dispatch({ type: "listen" });
    const transcript = await voice.start();
    dispatch({ type: "stopListening" });
    if (transcript) await ask(transcript);
  }, [voice, busy, dispatch, ask]);

  useEffect(() => {
    if (!window.mascot?.onStartListening) return;
    return window.mascot.onStartListening(() => {
      if (!voice.recording && !busy) void talk();
    });
  }, [talk, voice.recording, busy]);

  useEffect(() => {
    if (typing) input.current?.focus();
  }, [typing]);

  const submit = (event: FormEvent) => {
    event.preventDefault();
    void ask(draft);
  };

  const status = voice.recording ? (voice.phase === "connecting" ? "connecting…" : voice.partial || "listening…") : voice.finishing ? "finishing…" : pet === "thinking" ? "thinking…" : pet === "speaking" ? "speaking…" : null;

  return (
    <main className="companion">
      {showBubble && (
        <div className="answer" data-interactive onClick={() => setShowBubble(false)} role="presentation">
          <Bubble answer={lastAnswer} error={error} thinking={false} />
        </div>
      )}
      <div className="pet-dock" data-interactive>
        <div className="pet-handle" title="Drag to move Cortex · ⌥V to talk">
          <Pet state={pet} reaction={reaction} />
        </div>
        {status ? (
          <span className={`pet-status active${voice.recording ? " recording" : ""}`} aria-live="polite">
            {voice.recording && !voice.partial && (
              <i className="waves" aria-hidden>
                <b />
                <b />
                <b />
              </i>
            )}
            {status}
          </span>
        ) : (
          <div className="pet-actions" role="group" aria-label="Talk or type to Cortex">
            <button type="button" className="mini" onClick={() => void talk()} disabled={busy} aria-label="Talk to Cortex (Option V)">
              <MicIcon /> Talk
            </button>
            <button type="button" className="mini" onClick={() => setTyping((t) => !t)} disabled={busy} aria-pressed={typing} aria-label="Type to Cortex">
              <KeyboardIcon /> Type
            </button>
          </div>
        )}
        {voice.recording && (
          <button type="button" className="mini stop" onClick={() => voice.stop()} aria-label="Stop listening">
            <StopIcon /> Stop
          </button>
        )}
        {typing && !status && (
          <form className="type-line" onSubmit={submit}>
            <input ref={input} value={draft} onChange={(e) => setDraft(e.target.value)} placeholder="Ask Cortex…" maxLength={2000} onKeyDown={(e) => e.key === "Escape" && setTyping(false)} aria-label="Message to Cortex" />
            <button type="submit" className="mini send" disabled={!draft.trim()} aria-label="Send">
              <SendIcon />
            </button>
          </form>
        )}
      </div>
    </main>
  );
}
