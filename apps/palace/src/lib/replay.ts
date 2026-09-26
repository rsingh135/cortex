/**
 * Replay mode for beat 1: re-emit a recorded event log on a timer so the palace animates
 * deterministically without waiting on live extraction. Pure scheduling; the store's
 * `applyEvent` is the sink. Timing is relative to each event's `ts`, compressed by `speed`
 * and clamped so a long gap in the recording never stalls the demo.
 */
import { WsEvent } from "@cortex/schema";

export interface ReplayOptions {
  /** Playback speed multiplier; 4 means a 4 s gap in the log plays in 1 s. */
  speed?: number;
  /** Longest pause between two events, in ms, after speed is applied. */
  maxGapMs?: number;
  /** Shortest pause, so bursts still read as separate animations. */
  minGapMs?: number;
  setTimeoutFn?: typeof setTimeout;
  clearTimeoutFn?: typeof clearTimeout;
}

export interface Replay {
  start(): void;
  stop(): void;
  readonly total: number;
  readonly played: number;
  readonly running: boolean;
}

/** Parse a JSONL event log. Invalid lines are dropped and counted. */
export function parseEventLog(text: string): { events: WsEvent[]; dropped: number } {
  const events: WsEvent[] = [];
  let dropped = 0;
  for (const line of text.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    try {
      const parsed = WsEvent.safeParse(JSON.parse(trimmed));
      if (parsed.success) events.push(parsed.data);
      else dropped += 1;
    } catch {
      dropped += 1;
    }
  }
  return { events: events.sort((a, b) => Date.parse(a.ts) - Date.parse(b.ts)), dropped };
}

/** Delays between consecutive events after speed and clamping. Index 0 is the delay before the first event. */
export function schedule(events: readonly WsEvent[], opts: ReplayOptions = {}): number[] {
  const speed = Math.max(0.01, opts.speed ?? 4);
  const maxGap = opts.maxGapMs ?? 2500;
  const minGap = opts.minGapMs ?? 250;
  const delays: number[] = [];
  let prev: number | null = null;
  for (const e of events) {
    const t = Date.parse(e.ts);
    const raw = prev === null ? 0 : Math.max(0, t - prev) / speed;
    delays.push(prev === null ? 0 : Math.min(maxGap, Math.max(minGap, raw)));
    prev = t;
  }
  return delays;
}

export function createReplay(events: readonly WsEvent[], emit: (e: WsEvent) => void, opts: ReplayOptions = {}): Replay {
  const setT = opts.setTimeoutFn ?? setTimeout;
  const clearT = opts.clearTimeoutFn ?? clearTimeout;
  const delays = schedule(events, opts);
  let index = 0;
  let handle: ReturnType<typeof setTimeout> | null = null;
  let running = false;

  const step = (): void => {
    if (!running || index >= events.length) {
      running = false;
      handle = null;
      return;
    }
    emit(events[index]!);
    index += 1;
    if (index >= events.length) {
      running = false;
      handle = null;
      return;
    }
    handle = setT(step, delays[index]!);
  };

  return {
    get total() {
      return events.length;
    },
    get played() {
      return index;
    },
    get running() {
      return running;
    },
    start() {
      if (running) return;
      running = true;
      index = 0;
      handle = setT(step, delays[0] ?? 0);
    },
    stop() {
      running = false;
      if (handle !== null) clearT(handle);
      handle = null;
    },
  };
}
