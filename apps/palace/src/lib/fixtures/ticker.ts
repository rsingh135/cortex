/**
 * Fake live feed. Emits one plausible WsEvent every 1.5-4 s while running; the event sequence is a
 * deterministic function of the seed and the snapshot it reads through `getSnapshot`.
 */
import { DEFAULT_PARAMS, reinforce, type WsEvent } from "@cortex/schema";
import { levelBytes } from "../bytes";
import type { PalaceBelief, PalaceCapture, PalaceSnapshot } from "../types";
import { createPrng, type Prng } from "./prng";

export interface Ticker {
  start(): void;
  stop(): void;
  /** Next event without scheduling; null when the snapshot has nothing to say. */
  next(): WsEvent | null;
  readonly running: boolean;
}

export interface TickerOptions {
  minDelayMs?: number;
  maxDelayMs?: number;
  now?: () => string;
}

export function createTicker(seed: number, getSnapshot: () => PalaceSnapshot, emit: (e: WsEvent) => void, options: TickerOptions = {}): Ticker {
  const prng = createPrng(seed ^ 0x7ec7e5);
  const minDelay = options.minDelayMs ?? 1500;
  const maxDelay = options.maxDelayMs ?? 4000;
  const now = options.now ?? (() => new Date().toISOString());
  let counter = 0;
  let handle: ReturnType<typeof setTimeout> | null = null;
  let running = false;
  /** A cracked procedure the ticker owes a heal to. */
  let pendingHeal: string | null = null;
  /** Cascade queue: capture.recalled events that follow a belief.recalled. */
  const queue: WsEvent[] = [];

  const envelope = () => ({ id: `tick_${seed.toString(16)}_${(counter++).toString(36).padStart(4, "0")}`, day: getSnapshot().day, ts: now(), condition: "cortex" as const });

  const next = (): WsEvent | null => {
    const queued = queue.shift();
    if (queued) return queued;
    const snapshot = getSnapshot();
    const beliefs = snapshot.beliefs.filter((b) => (b.status === "active" || b.status === "cracked") && b.createdDay <= snapshot.day);
    if (beliefs.length === 0) return null;
    if (pendingHeal) {
      const id = pendingHeal;
      pendingHeal = null;
      return { ...envelope(), type: "procedure.healed", payload: { procedure_id: id, run_id: `run_${prng.hex(8)}` } };
    }
    const roll = prng.next();
    if (roll < 0.45) return recallCascade(snapshot, beliefs, prng, envelope, queue);
    if (roll < 0.68) return deleteLevel(snapshot, prng, envelope) ?? reinforceBelief(beliefs, prng, envelope);
    if (roll < 0.9) return reinforceBelief(beliefs, prng, envelope);
    const active = snapshot.procedures.filter((p) => p.status === "active");
    const prefs = beliefs.filter((b) => b.kind === "preference");
    if (active.length && prefs.length) {
      const proc = prng.pick(active);
      const by = prng.pick(prefs);
      pendingHeal = proc.id;
      return { ...envelope(), type: "procedure.cracked", payload: { procedure_id: proc.id, by_belief_id: by.id, attr: attrOf(by) } };
    }
    return reinforceBelief(beliefs, prng, envelope);
  };

  const schedule = () => {
    if (!running) return;
    handle = setTimeout(() => {
      handle = null;
      if (!running) return;
      const e = next();
      if (e) emit(e);
      schedule();
    }, prng.int(minDelay, maxDelay));
  };

  return {
    start() {
      if (running) return;
      running = true;
      schedule();
    },
    stop() {
      running = false;
      if (handle !== null) clearTimeout(handle);
      handle = null;
    },
    next,
    get running() {
      return running;
    },
  };
}

type Envelope = () => { id: string; day: number; ts: string; condition: "cortex" };

function recallCascade(snapshot: PalaceSnapshot, beliefs: readonly PalaceBelief[], prng: Prng, envelope: Envelope, queue: WsEvent[]): WsEvent {
  const housing = beliefs.filter((b) => b.room === "Housing");
  const belief = prng.pick(prng.chance(0.6) && housing.length ? housing : beliefs);
  const captureById = new Map(snapshot.captures.map((c) => [c.id, c]));
  for (const id of belief.evidence) {
    const c = captureById.get(id);
    if (!c || c.ceiling === null) continue;
    queue.push({
      ...envelope(),
      type: "capture.recalled",
      payload: { capture_id: c.id, clarity: DEFAULT_PARAMS.levelValue[c.ceiling], ceiling: c.ceiling, recalls: c.recalls + 1, cascaded_from: belief.id },
    });
  }
  const reason = prng.pick(["agent hunt cited this rule", "answered a question from Maya", "usage log replay", "draft message used this"]);
  return { ...envelope(), type: "belief.recalled", payload: { belief_id: belief.id, confidence: Math.min(1, Math.max(belief.confidence, belief.c0 * 0.9)), recalls: belief.recalls + 1, reason } };
}

function deleteLevel(snapshot: PalaceSnapshot, prng: Prng, envelope: Envelope): WsEvent | null {
  const candidates = snapshot.captures.filter((c: PalaceCapture) => c.ceiling !== null && c.day <= snapshot.day && c.recallDays.length === 0);
  if (candidates.length === 0) return null;
  const c = prng.pick(candidates);
  const level = c.ceiling as NonNullable<PalaceCapture["ceiling"]>;
  const remaining = c.aliveLevels.filter((l) => l !== level);
  const ceiling = remaining[0] ?? null;
  return { ...envelope(), type: "level.deleted", payload: { capture_id: c.id, levels: [level], ceiling, bytes_freed: levelBytes(level, c.l0Bytes) } };
}

function reinforceBelief(beliefs: readonly PalaceBelief[], prng: Prng, envelope: Envelope): WsEvent {
  const belief = prng.pick(beliefs);
  return { ...envelope(), type: "belief.reinforced", payload: { belief_id: belief.id, confidence: reinforce(belief.confidence, DEFAULT_PARAMS), evidence_added: [] } };
}

function attrOf(belief: PalaceBelief): string | undefined {
  const m = /(?:requires|prefers) (\w+) /.exec(belief.ruleText ?? "");
  return m?.[1];
}
