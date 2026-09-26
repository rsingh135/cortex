import { useRef, useState, type FormEvent } from "react";
import { NotImplementedError, recordWhile, transcribe } from "../lib/stt";

interface ComposerProps {
  disabled: boolean;
  onAsk(text: string): void;
  onListen(active: boolean): void;
  onError(message: string): void;
}

export function Composer({ disabled, onAsk, onListen, onError }: ComposerProps) {
  const [text, setText] = useState("");
  const holding = useRef(false);

  const submit = (e: FormEvent): void => {
    e.preventDefault();
    const t = text.trim();
    if (!t || disabled) return;
    setText("");
    onAsk(t);
  };

  const startHold = async (): Promise<void> => {
    if (disabled || holding.current) return;
    holding.current = true;
    onListen(true);
    try {
      const blob = await recordWhile(() => holding.current);
      const transcript = await transcribe(blob);
      onAsk(transcript);
    } catch (err) {
      onError(err instanceof NotImplementedError ? "Voice input not wired yet. Type instead." : err instanceof Error ? err.message : String(err));
    } finally {
      onListen(false);
    }
  };
  const endHold = (): void => {
    holding.current = false;
  };

  return (
    <form onSubmit={submit} className="flex items-center gap-1.5">
      <input
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder="Ask Cortex…"
        aria-label="Ask Cortex"
        disabled={disabled}
        className="h-8 w-[180px] rounded-full bg-white/95 px-3 text-[13px] text-zinc-900 shadow ring-1 ring-zinc-200 outline-none focus:ring-indigo-400 disabled:opacity-60"
      />
      <button
        type="button"
        aria-label="Hold to talk"
        title="Hold to talk"
        disabled={disabled}
        onPointerDown={() => void startHold()}
        onPointerUp={endHold}
        onPointerLeave={endHold}
        onPointerCancel={endHold}
        className="grid h-8 w-8 place-items-center rounded-full bg-white/95 text-zinc-700 shadow ring-1 ring-zinc-200 active:bg-amber-100 disabled:opacity-60"
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
          <path d="M12 14a3 3 0 0 0 3-3V5a3 3 0 1 0-6 0v6a3 3 0 0 0 3 3Zm5-3a5 5 0 0 1-10 0H5a7 7 0 0 0 6 6.92V21h2v-3.08A7 7 0 0 0 19 11h-2Z" />
        </svg>
      </button>
    </form>
  );
}
