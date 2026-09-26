import { useEffect } from "react";
import { Bubble } from "./components/Bubble";
import { Composer } from "./components/Composer";
import { Pet } from "./components/Pet";
import { useMascotStore } from "./lib/store";
import { speak } from "./lib/tts";

const REACTION_MS = 800;

export function App() {
  const { pet, reaction, lastAnswer, error, dispatch } = useMascotStore();

  // Engine events make the pet react; clicks outside the pet fall through to the desktop.
  useEffect(() => {
    if (typeof window.mascot === "undefined") return;
    return window.mascot.onEvent((event) => dispatch({ type: "engineEvent", event }));
  }, [dispatch]);

  useEffect(() => {
    if (pet !== "reacting") return;
    const t = setTimeout(() => dispatch({ type: "reactionDone" }), REACTION_MS);
    return () => clearTimeout(t);
  }, [pet, dispatch]);

  const ask = async (text: string): Promise<void> => {
    dispatch({ type: "asked", text });
    try {
      const response = await window.mascot.ask(text, { speak: true });
      dispatch({ type: "answered", response });
      await speak(response.audio_url);
      dispatch({ type: "doneSpeaking" });
    } catch (err) {
      dispatch({ type: "failed", message: err instanceof Error ? err.message : String(err) });
    }
  };

  const busy = pet === "thinking" || pet === "listening";

  return (
    <div
      className="flex h-full w-full items-start justify-center pt-1"
      onMouseEnter={() => window.mascot?.setClickThrough(false)}
      onMouseLeave={() => window.mascot?.setClickThrough(true)}
    >
      <div className="flex items-start gap-2">
        <div className="flex flex-col items-center gap-1">
          <Pet state={pet} reaction={reaction} />
          <Composer
            disabled={busy}
            onAsk={(t) => void ask(t)}
            onListen={(active) => dispatch(active ? { type: "listen" } : { type: "stopListening" })}
            onError={(message) => dispatch({ type: "failed", message })}
          />
        </div>
        <div className="pt-4">
          <Bubble answer={lastAnswer} error={error} thinking={pet === "thinking"} />
        </div>
      </div>
    </div>
  );
}
