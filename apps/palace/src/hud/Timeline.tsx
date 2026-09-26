"use client";
/**
 * Day scrubber 1–30 with day ticks and checkpoint marks, play/pause for the ticker and a fast-forward
 * that advances one day per 400 ms until day 30 (or a checkpoint clicked ahead of today). In live
 * mode each advance is a POST to the engine; the next one waits until the clock.advanced event has
 * actually moved the snapshot's day, so a slow engine never receives a pile of requests.
 */
import { useEffect, useState } from "react";
import { formatDay } from "@/lib/format";
import { MAX_DAY, MIN_DAY, useConnection, useDay, usePalaceActions, usePalaceStore, usePlaying } from "@/lib/store";
import { FastForwardIcon, PauseIcon, PlayIcon } from "./icons";
import { TimelineTick } from "./TimelineTick";

export const CHECKPOINT_DAYS = [5, 10, 15, 20, 25, 30] as const;
export const FAST_FORWARD_INTERVAL_MS = 400;

const BUTTON = "lift inline-flex h-9 min-w-9 items-center justify-center rounded-lg bg-white/70 px-2.5 text-[13px] font-medium text-zinc-700 ring-1 ring-inset ring-zinc-900/10 hover:bg-white hover:text-zinc-900 focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-sky-600 disabled:cursor-not-allowed disabled:opacity-40";
/** Half the thumb width: the track, ticks and fill sit inside this inset so they meet the thumb's centre. */
const INSET = "9px";
const DAYS = Array.from({ length: MAX_DAY - MIN_DAY + 1 }, (_, i) => MIN_DAY + i);

function percentOf(day: number): number {
  return ((day - MIN_DAY) / (MAX_DAY - MIN_DAY)) * 100;
}

export function Timeline() {
  const day = useDay();
  const playing = usePlaying();
  const { mode } = useConnection();
  const { setDay, setPlaying } = usePalaceActions();
  const [target, setTarget] = useState<number | null>(null);

  useEffect(() => {
    if (target === null) return;
    let requested = usePalaceStore.getState().snapshot.day;
    const handle = setInterval(() => {
      const state = usePalaceStore.getState();
      const current = state.snapshot.day;
      // Live: the engine owns the clock; hold until the last request has landed.
      if (state.mode === "live" && current < requested) return;
      const next = Math.max(current, requested) + 1;
      if (next > target) {
        setTarget(null);
        return;
      }
      requested = next;
      setDay(next);
      if (next >= target) setTarget(null);
    }, FAST_FORWARD_INTERVAL_MS);
    return () => clearInterval(handle);
  }, [target, setDay]);

  const jump = (d: number) => {
    setTarget(null);
    setDay(d);
  };
  const fastForward = (to: number) => setTarget((t) => (t === null ? to : null));
  const running = target !== null;
  const percent = percentOf(day);

  return (
    <div className="glass w-[min(36rem,calc(100vw-2rem))] max-w-full rounded-2xl p-3" role="group" aria-label="Timeline">
      <div className="flex items-center gap-2">
        <button type="button" className={`${BUTTON} ${playing ? "bg-white text-zinc-900" : ""}`} onClick={() => setPlaying(!playing)} aria-pressed={playing} aria-label={playing ? "Pause the memory ticker" : "Play the memory ticker"} disabled={mode !== "fixture"}>
          {playing ? <PauseIcon /> : <PlayIcon />}
        </button>
        <button type="button" className={BUTTON} onClick={() => jump(day - 1)} aria-label="Previous day" disabled={day <= MIN_DAY || running}>
          −1
        </button>
        <button type="button" className={BUTTON} onClick={() => jump(day + 1)} aria-label="Next day" disabled={day >= MAX_DAY || running}>
          +1
        </button>
        <button
          type="button"
          className={`${BUTTON} relative overflow-hidden ${running ? "bg-sky-50 text-sky-900 ring-sky-300" : ""}`}
          onClick={() => fastForward(MAX_DAY)}
          aria-pressed={running}
          aria-label={running ? `Stop fast-forwarding at ${formatDay(target)}` : `Fast-forward to ${formatDay(MAX_DAY)}`}
          disabled={day >= MAX_DAY && !running}
        >
          {running && <span aria-hidden className="shimmer pointer-events-none absolute inset-0" />}
          <FastForwardIcon />
          <span className="ml-1 tabular-nums">{running ? `→ ${target}` : `→ ${MAX_DAY}`}</span>
        </button>
        <div className="ml-auto text-base font-semibold tabular-nums tracking-tight text-zinc-900" aria-live="polite">
          {formatDay(day)}
          <span className="ml-1 text-[13px] font-normal text-zinc-500">/ {MAX_DAY}</span>
        </div>
      </div>

      <div className="relative mt-1.5">
        {/* Track: base, day ticks, glowing fill. Inset by half a thumb so percentages meet the thumb's centre. */}
        <div className="pointer-events-none absolute top-[11px] h-1.5 rounded-full bg-zinc-900/10" style={{ left: INSET, right: INSET }} aria-hidden>
          {DAYS.map((d) => (
            <span key={d} className={`absolute top-1/2 h-1 w-px -translate-y-1/2 ${d <= day ? "bg-white/70" : "bg-zinc-900/15"}`} style={{ left: `${percentOf(d)}%` }} />
          ))}
          <div className="absolute inset-y-0 left-0 rounded-full bg-gradient-to-r from-sky-500 to-sky-600 shadow-[0_0_10px_rgba(14,165,233,0.45)] transition-[width] duration-300 ease-spring-soft" style={{ width: `${percent}%` }} />
        </div>
        <input type="range" min={MIN_DAY} max={MAX_DAY} step={1} value={day} onChange={(e) => jump(Number(e.target.value))} aria-label="Day" aria-valuetext={formatDay(day)} className="scrubber relative z-10 block" />
        <div className="relative h-6" style={{ marginLeft: INSET, marginRight: INSET }} aria-label="Checkpoints" role="group">
          {CHECKPOINT_DAYS.map((d) => (
            <TimelineTick key={d} day={d} current={day} left={percentOf(d)} active={target === d} onJump={jump} onFastForward={fastForward} />
          ))}
        </div>
      </div>
    </div>
  );
}
