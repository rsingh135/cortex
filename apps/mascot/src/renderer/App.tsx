import { useEffect, useRef, useState } from "react";
import { Bubble } from "./components/Bubble";
import { Composer } from "./components/Composer";
import { Pet } from "./components/Pet";
import { useMascotStore } from "./lib/store";
import { speakText, stopSpeech, unlockSpeech } from "./lib/tts";
import type { MemoryNote } from "../shared/types";

export function App() {
  const { pet, reaction, lastAnswer, error, dispatch } = useMascotStore();
  const [open, setOpen] = useState(false);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const drag = useRef<{ x: number; y: number; ox: number; oy: number; moved: boolean } | null>(null);
  const suppressClick = useRef(false);
  useEffect(() => {
    const stop = () => { drag.current = null; window.mascot?.setDragging?.(false); };
    window.addEventListener('blur', stop);
    return () => { stop(); window.removeEventListener('blur', stop); };
  }, []);
  const [mode, setMode] = useState<"remember" | "ask">("remember");
  const [notes, setNotes] = useState<MemoryNote[]>([]);
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState("");
  const [voiceEnabled, setVoiceEnabled] = useState(false);
  const voiceOn = useRef(false);
  useEffect(() => () => { voiceOn.current = false; stopSpeech(); }, []);
  const say = async (text: string) => {
    if (!voiceOn.current) return;
    dispatch({ type: "startSpeaking" });
    try { await speakText(text); }
    catch (error) { if (voiceOn.current) dispatch({ type: "failed", message: error instanceof Error ? error.message : String(error) }); }
    finally { dispatch({ type: "doneSpeaking" }); }
  };
  const toggleVoice = async () => {
    const enabled = !voiceOn.current;
    voiceOn.current = enabled; setVoiceEnabled(enabled);
    if (!enabled) { stopSpeech(); dispatch({ type: "doneSpeaking" }); return; }
    try {
      await unlockSpeech();
      await say("Hi, I’m Cortex. I’m here to listen. Tell me a little thought you’d like to keep.");
    } catch (error) {
      voiceOn.current = false; setVoiceEnabled(false);
      dispatch({ type: "failed", message: error instanceof Error ? error.message : String(error) });
    }
  };
  const busy = saving || pet === "thinking" || pet === "listening" || pet === "speaking";
  const fail = (message: string) => dispatch({ type: "failed", message });
  useEffect(() => {
    if (!window.mascot) return;
    void window.mascot.listMemories().then(setNotes).catch((err: Error) => dispatch({ type: "failed", message: err.message }));
    return window.mascot.onEvent((event) => dispatch({ type: "engineEvent", event }));
  }, [dispatch]);
  useEffect(() => {
    if (pet !== "reacting") return;
    const timer = setTimeout(() => dispatch({ type: "reactionDone" }), 800);
    return () => clearTimeout(timer);
  }, [pet, dispatch]);
  useEffect(() => {
    // The full transparent window must not intercept clicks outside visible controls.
    const move = (event: MouseEvent) => {
      const interactive = (event.target as Element).closest?.("[data-interactive]");
      window.mascot?.setClickThrough(!interactive);
    };
    const leave = () => window.mascot?.setClickThrough(true);
    document.addEventListener("mousemove", move);
    document.addEventListener("mouseleave", leave);
    return () => { document.removeEventListener("mousemove", move); document.removeEventListener("mouseleave", leave); };
  }, []);
  const submit = async (text: string): Promise<boolean> => {
    setNotice("");
    if (!window.mascot) { fail("Open the desktop app to save memories or use voice."); return false; }
    dispatch({ type: "asked", text });
    try {
      if (mode === "remember") {
        setSaving(true);
        const note = await window.mascot.saveMemory(text);
        setNotes(await window.mascot.listMemories());
        dispatch({ type: "memorySaved" });
        const confirmation = note.status === "synced" ? "Memory added. I’ll keep it in mind." : "I’ve kept that on this device. It’s waiting for the memory engine.";
        setNotice(confirmation);
        await say(confirmation);
      } else {
        const response = await window.mascot.ask(text, { speak: false });
        dispatch({ type: "answered", response });
        await say(response.answer);
        dispatch({ type: "doneSpeaking" });
      }
      return true;
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      if (mode === "ask") await say("I can hear you, but my memory engine isn’t available yet. You can still add a memory for me to keep on this device.");
      fail(message); return false;
    }
    finally { setSaving(false); }
  };
  const retry = async (id: string) => {
    setSaving(true);
    try {
      const note = await window.mascot.retryMemory(id);
      setNotes(await window.mascot.listMemories());
      setNotice(note.status === "synced" ? "Memory added to Cortex." : `Still kept locally. ${note.error ?? "Delivery could not be confirmed."}`);
    } catch (err) { fail(err instanceof Error ? err.message : String(err)); }
    finally { setSaving(false); }
  };
  const dockX = window.innerWidth - 180 + offset.x;
  const dockY = window.innerHeight - 164 + offset.y;
  const panelAbove = dockY > window.innerHeight / 2;
  const panelLeft = Math.max(12 - dockX, -200);
  return <main className="companion" style={{ transform: `translate(${offset.x}px, ${offset.y}px)` }}>
    <div className="pet-dock" data-interactive>
      <button className="pet-button" aria-label="Cortex — click to open, drag to move" onPointerDown={event => {
        if (event.button !== 0) return;
        suppressClick.current = false;
        drag.current = { x: event.clientX, y: event.clientY, ox: offset.x, oy: offset.y, moved: false };
        event.currentTarget.setPointerCapture(event.pointerId);
      }} onPointerMove={event => {
        const start = drag.current; if (!start) return;
        const dx = event.clientX - start.x, dy = event.clientY - start.y;
        if (!start.moved && Math.hypot(dx, dy) < 5) return;
        if (!start.moved) { start.moved = true; window.mascot?.setDragging?.(true); }
        suppressClick.current = true;
        if (!window.mascot?.setDragging) setOffset({
          x: Math.max(170 - window.innerWidth, Math.min(12, start.ox + dx)),
          y: Math.max(170 - window.innerHeight, Math.min(12, start.oy + dy)),
        });
      }} onPointerUp={event => {
        drag.current = null; window.mascot?.setDragging?.(false);
        if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
      }} onPointerCancel={() => { drag.current = null; window.mascot?.setDragging?.(false); }} onClick={() => { if (suppressClick.current) { suppressClick.current = false; return; } if (!busy) setOpen(!open); }} aria-expanded={open} aria-controls="memory-panel" title={open ? "Close Cortex" : "Add a memory"}>
        <Pet state={pet} reaction={reaction}/>
        <span className={`pet-status ${pet !== "idle" ? "active" : ""}`}>{pet === "idle" || pet === "reacting" ? "a little space for your mind" : saving ? "keeping your memory…" : `${pet}…`}</span>
      </button>
    </div>
    {open && <section id="memory-panel" style={{ left: panelLeft, right: 'auto', bottom: panelAbove ? 152 : 'auto', top: panelAbove ? 'auto' : 152, maxHeight: Math.max(120, panelAbove ? dockY - 20 : window.innerHeight - dockY - 170) }} className="memory-panel" data-interactive aria-label="Cortex memory companion">
      <header className="panel-header"><div><span className="eyebrow"><i/> YOUR MEMORY COMPANION</span><h1>Hi, I’m Cortex<span>.</span></h1></div><button className="close-button" onClick={() => setOpen(false)} disabled={busy} aria-label="Close memory panel">×</button></header>
      <p className="intro">Little thoughts. Safely tucked away.</p>
      <div className="voice-conversation">
        <div><strong>Talk with Cortex</strong><small>{voiceEnabled ? "Live voice input · spoken replies" : "Optional voice conversation"}</small></div>
        <button type="button" role="switch" aria-checked={voiceEnabled} aria-label="Talk with Cortex" className="voice-switch" onClick={() => void toggleVoice()} disabled={pet === "thinking" || pet === "listening"}><span/></button>
      </div>
      {voiceEnabled && <div className="voice-guidance">Tap Use voice, speak, then Stop. Review your words and send.<button type="button" className="hear-emma" disabled={busy} onClick={() => void say("Hi, I’m Cortex. What’s on your mind?")}>Hear Cortex</button></div>}
      <div className="mode-switch" role="group" aria-label="Choose an action">
        <button aria-pressed={mode === "remember"} disabled={busy} onClick={() => setMode("remember")}>＋ Add a memory</button>
        <button aria-pressed={mode === "ask"} disabled={busy} onClick={() => setMode("ask")}>✧ Ask Cortex</button>
      </div>
      <Composer disabled={busy} mode={mode} onSubmit={submit} onListen={(active) => dispatch(active ? { type: "listen" } : { type: "stopListening" })} onError={fail}/>
      <div className="feedback" aria-live="polite">{notice && <p className="notice">{notice}</p>}<Bubble answer={mode === "ask" ? lastAnswer : null} error={error} thinking={pet === "thinking"}/></div>
      {mode === "remember" && notes.length > 0 && <div className="recent"><div className="recent-title">RECENT MEMORIES<span>{notes.length} kept</span></div>
        <div className="note-list">{notes.slice(0, 20).map((note) => <article key={note.id} className="note"><span className={`note-dot ${note.status}`}/><div><p>{note.text}</p><small>{note.status === "synced" ? "Added to Cortex" : "On this device · delivery unconfirmed"}</small></div>{note.status === "pending" && <button disabled={busy} onClick={() => void retry(note.id)} title="Retry delivery. If an earlier request succeeded but its reply was lost, this may duplicate the memory.">Retry</button>}</article>)}</div>
      </div>}
      <footer><span className="footer-dot"/> Here whenever a thought finds you<span className="drag-handle" title="Drag to move Cortex">⠿</span></footer>
    </section>}
  </main>;
}
