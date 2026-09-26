"use client";
/**
 * Day scrubber 1–30 with checkpoint ticks, play/pause for the ticker and a fast-forward that
 * advances one day per 400 ms until day 30 (or a checkpoint clicked ahead of today). In live mode
 * each advance is a POST to the engine; the next one waits until the clock.advanced event has
 * actually moved the snapshot's day, so a slow engine never receives a pile of requests.
 */
import { useEffect, useState } from "react";
import { formatDay } from "@/lib/format";
import { MAX_DAY, MIN_DAY, useConnection, useDay, usePalaceActions, usePalaceStore, usePlaying } from "@/lib/store";
import { FastForwardIcon, PauseIcon, PlayIcon } from "./icons";
import { TimelineTick } from "./TimelineTick";

export const CHECKPOINT_DAYS = [5, 10, 15, 20, 25, 30] as const;
export const FAST_FORWARD_INTERVAL_MS = 400;

const BUTTON = "inline-flex h-9 min-w-9 items-center justify-center rounded-md px-2.5 text-sm font-medium text-zinc-700 ring-1 ring-inset ring-zinc-200 transition hover:bg-zinc-100 focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-sky-600 disabled:cursor-not-allowed disabled:opacity-40";

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
  const percent = ((day - MIN_DAY) / (MAX_DAY - MIN_DAY)) * 100;

  return (
    <div className="w-[min(36rem,calc(100vw-2rem))] max-w-full rounded-xl bg-white/90 p-3 shadow-sm ring-1 ring-zinc-200 backdrop-blur" role="group" aria-label="Timeline">
      <div className="flex items-center gap-2">
        <button type="button" className={BUTTON} onClick={() => setPlaying(!playing)} aria-pressed={playing} aria-label={playing ? "Pause the memory ticker" : "Play the memory ticker"} disabled={mode !== "fixture"}>
          {playing ? <PauseIcon /> : <PlayIcon />}
        </button>
        <button type="button" className={BUTTON} onClick={() => jump(day - 1)} aria-label="Previous day" disabled={day <= MIN_DAY || target !== null}>
          −1
        </button>
        <button type="button" className={BUTTON} onClick={() => jump(day + 1)} aria-label="Next day" disabled={day >= MAX_DAY || target !== null}>
          +1
        </button>
        <button type="button" className={`${BUTTON} ${target !== null ? "bg-sky-50 text-sky-800 ring-sky-300" : ""}`} onClick={() => fastForward(MAX_DAY)} aria-pressed={target !== null} aria-label={target !== null ? `Stop fast-forwarding at ${formatDay(target)}` : `Fast-forward to ${formatDay(MAX_DAY)}`} disabled={day >= MAX_DAY && target === null}>
          <FastForwardIcon />
          <span className="ml-1 tabular-nums">{target !== null ? `→ ${target}` : `→ ${MAX_DAY}`}</span>
        </button>
        <div className="ml-auto text-base font-semibold tabular-nums text-zinc-900" aria-live="polite">
          {formatDay(day)}
          <span className="ml-1 text-sm font-normal text-zinc-500">/ {MAX_DAY}</span>
        </div>
      </div>

      <div className="relative mt-3 px-1">
        <div className="pointer-events-none absolute inset-x-1 top-[7px] h-1.5 rounded-full bg-sky-100" aria-hidden>
          <div className="h-full rounded-full bg-sky-600 transition-[width] duration-300" style={{ width: `${percent}%` }} />
        </div>
        <input
          type="range"
          min={MIN_DAY}
          max={MAX_DAY}
          step={1}
          value={day}
          onChange={(e) => jump(Number(e.target.value))}
          aria-label="Day"
          aria-valuetext={formatDay(day)}
          className="relative z-10 block h-5 w-full cursor-pointer appearance-none bg-transparent accent-sky-600 [&::-moz-range-thumb]:h-4 [&::-moz-range-thumb]:w-4 [&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:border-2 [&::-moz-range-thumb]:border-white [&::-moz-range-thumb]:bg-sky-600 [&::-moz-range-thumb]:shadow [&::-moz-range-track]:h-1.5 [&::-moz-range-track]:rounded-full [&::-moz-range-track]:bg-transparent [&::-webkit-slider-runnable-track]:h-1.5 [&::-webkit-slider-runnable-track]:rounded-full [&::-webkit-slider-runnable-track]:bg-transparent [&::-webkit-slider-thumb]:-mt-[5px] [&::-webkit-slider-thumb]:h-4 [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:border-2 [&::-webkit-slider-thumb]:border-white [&::-webkit-slider-thumb]:bg-sky-600 [&::-webkit-slider-thumb]:shadow"
        />
        <div className="relative mt-1 h-6" aria-label="Checkpoints" role="group">
          {CHECKPOINT_DAYS.map((d) => (
            <TimelineTick key={d} day={d} current={day} left={((d - MIN_DAY) / (MAX_DAY - MIN_DAY)) * 100} active={target === d} onJump={jump} onFastForward={fastForward} />
          ))}
        </div>
      </div>
    </div>
  );
}
