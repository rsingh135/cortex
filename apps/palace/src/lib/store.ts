"use client";
/**
 * The palace store. One zustand store, one reducer (`applyEvent`), one sweep (`setDay`).
 * Fixture mode: generated memory plus a fake ticker. Live mode: GET /snapshot, then a WebSocket.
 */
import { WsEvent, type AgentDraft, type WsEventType } from "@cortex/schema";
import { create } from "zustand";
import { useShallow } from "zustand/react/shallow";
import type { TextureResolver } from "./adapt";
import { DEFAULT_SEED, generateFixture } from "./fixtures/generate";
import { fixtureScreenKey } from "./fixtures/screenUrl";
import { createTicker, type Ticker } from "./fixtures/ticker";
import { computeLayout, type PalaceLayout, type Placement } from "./layout";
import { reduceSnapshot } from "./reducer";
import { createReplay, parseEventLog, type Replay } from "./replay";
import { sweepSnapshot } from "./sweep";
import { emptySnapshot, type PalaceBelief, type PalaceCapture, type PalaceProcedure, type PalaceSnapshot } from "./types";

export type PalaceMode = "fixture" | "live";
export type ConnectionState = "connecting" | "open" | "closed";
export type ControlsMode = "walk" | "orbit";
export type ReplayStatus = "idle" | "loading" | "playing" | "done";

export interface ReplayState {
  status: ReplayStatus;
  played: number;
  total: number;
}

export interface Toast {
  id: number;
  text: string;
}

export interface WorkflowScore {
  withMemory: { right: number; of: number };
  noMemory: { right: number; of: number };
}

export interface ReplayOptions {
  /** Event log URL; defaults to the bundled day-2 log. */
  url?: string;
  /** Start from an empty day-2 memory so the walls fill in front of the audience. Default true. */
  fresh?: boolean;
}

export interface PalaceState {
  mode: PalaceMode;
  connection: ConnectionState;
  snapshot: PalaceSnapshot;
  /** Recomputed when snapshot membership changes. */
  layout: PalaceLayout;
  selectedId: string | null;
  hoveredId: string | null;
  /** id -> timestamp (ms) of the last recall pulse. */
  pulses: Record<string, number>;
  /** Newest first, at most 50. */
  recentEvents: WsEvent[];
  controlsMode: ControlsMode;
  /** Walk mode has the mouse captured (pointer lock). Written by the first-person controls. */
  pointerLocked: boolean;
  /** Fixture ticker running. */
  playing: boolean;
  /** Fixture seed (`?seed=`, default 42). */
  seed: number;
  /** Beat-1 replay of a recorded event log. */
  replay: ReplayState;
  /** Short-lived HUD notices, oldest first. */
  toasts: Toast[];
  /** Draft ids the agent is waiting on (beat 3); `approveAllDrafts()` posts them to the engine. */
  pendingDrafts: string[];
  /** The drafts themselves, for the approval card. */
  drafts: AgentDraft[];
  /** Split view: the mock world in an iframe beside the palace during the live hunt. */
  browserOpen: boolean;
  /** Live-hunt result for the chart page, once the engine reports it. */
  workflowScore: WorkflowScore | null;
  /** The `F` fallback video overlay. */
  fallbackOpen: boolean;
  applyEvent(e: WsEvent): void;
  setDay(day: number): void;
  select(id: string | null): void;
  hover(id: string | null): void;
  editBelief(id: string, text: string): void;
  deleteBelief(id: string): void;
  setControlsMode(m: ControlsMode): void;
  setPointerLocked(b: boolean): void;
  setPlaying(b: boolean): void;
  connect(): void;
  disconnect(): void;
  startReplay(opts?: ReplayOptions): Promise<void>;
  stopReplay(): void;
  toast(text: string): void;
  dismissToast(id: number): void;
  setPendingDrafts(ids: string[]): void;
  removeDraft(id: string): void;
  setBrowserOpen(open: boolean): void;
  setWorkflowScore(score: WorkflowScore | null): void;
  setFallbackOpen(open: boolean): void;
}

export const MAX_RECENT_EVENTS = 50;
export const MIN_DAY = 1;
export const MAX_DAY = 30;

const WS_URL = process.env.NEXT_PUBLIC_LIVE_SERVER_WS_URL;
/** Engine base URL (HTTP), derived from the WebSocket URL when not set explicitly; undefined in pure fixture mode. */
export const ENGINE_URL = process.env.NEXT_PUBLIC_ENGINE_URL ?? (WS_URL ? WS_URL.replace(/^ws(s?):\/\//, "http$1://").replace(/\/ws\/?$/, "") : undefined);
export const DEFAULT_REPLAY_URL = "/demo/day2-events.jsonl";
export const REPLAY_TIMING = { speed: 4, minGapMs: 250, maxGapMs: 2500 } as const;
const TOAST_MS = 2500;

/** Live when a WebSocket URL is configured and `?mode=fixture` is not forcing the fixture. */
export function detectMode(): PalaceMode {
  if (!WS_URL) return "fixture";
  if (typeof window !== "undefined" && new URLSearchParams(window.location.search).get("mode") === "fixture") return "fixture";
  return "live";
}

export function seedFromLocation(): number {
  if (typeof window === "undefined") return DEFAULT_SEED;
  const raw = new URLSearchParams(window.location.search).get("seed");
  const n = raw === null ? NaN : Number(raw);
  return Number.isFinite(n) ? Math.floor(n) >>> 0 : DEFAULT_SEED;
}

let ticker: Ticker | null = null;
let socket: WebSocket | null = null;
let replayHandle: Replay | null = null;
let replayRun = 0;
let syntheticCounter = 0;
let toastCounter = 0;

/** Fixture textures are cheap keys; the renderer rasterises them lazily (see `fixtures/screenUrl.ts`). */
const fixtureTexture = (seed: number): TextureResolver => (capture) => fixtureScreenKey(capture, seed);
const liveTexture: TextureResolver = (capture) => (ENGINE_URL && capture.ceiling !== null ? `${ENGINE_URL}/image/${capture.id}?condition=cortex` : null);

function pushEvents(recent: readonly WsEvent[], events: readonly WsEvent[]): WsEvent[] {
  return [...[...events].reverse(), ...recent].slice(0, MAX_RECENT_EVENTS);
}

function stampPulses(pulses: Record<string, number>, ids: readonly string[], now: number): Record<string, number> {
  if (ids.length === 0) return pulses;
  const next = { ...pulses };
  for (const id of ids) next[id] = now;
  return next;
}

function syntheticEnvelope(day: number) {
  return { id: `syn_${(syntheticCounter++).toString(36).padStart(6, "0")}`, day, ts: new Date().toISOString(), condition: "cortex" as const };
}

export const usePalaceStore = create<PalaceState>()((set, get) => {
  const initial = emptySnapshot(1);
  return {
    mode: "fixture",
    connection: "closed",
    snapshot: initial,
    layout: computeLayout(initial),
    selectedId: null,
    hoveredId: null,
    pulses: {},
    recentEvents: [],
    controlsMode: "walk",
    pointerLocked: false,
    playing: true,
    seed: DEFAULT_SEED,
    replay: { status: "idle", played: 0, total: 0 },
    toasts: [],
    pendingDrafts: [],
    drafts: [],
    browserOpen: false,
    workflowScore: null,
    fallbackOpen: false,

    applyEvent(e) {
      const state = get();
      const texture = state.mode === "live" ? liveTexture : fixtureTexture(state.seed);
      const result = reduceSnapshot(state.snapshot, e, texture);
      if (e.type === "agent.drafts") {
        const incoming = e.payload.drafts;
        const kept = state.drafts.filter((d) => !incoming.some((n) => n.draft_id === d.draft_id));
        const drafts = [...kept, ...incoming];
        set({ drafts, pendingDrafts: drafts.map((d) => d.draft_id), browserOpen: true });
      } else if (e.type === "agent.draft_sent") {
        set({ drafts: state.drafts.filter((d) => d.draft_id !== e.payload.draft_id), pendingDrafts: state.pendingDrafts.filter((id) => id !== e.payload.draft_id) });
      } else if (e.type === "procedure.step" && !state.browserOpen) {
        set({ browserOpen: true });
      }
      set({
        snapshot: result.snapshot,
        layout: result.membershipChanged ? computeLayout(result.snapshot) : state.layout,
        pulses: stampPulses(state.pulses, result.pulses, Date.now()),
        recentEvents: pushEvents(state.recentEvents, [e]),
        selectedId: state.selectedId && !exists(result.snapshot, state.selectedId) ? null : state.selectedId,
      });
    },

    setDay(day) {
      const clamped = Math.max(MIN_DAY, Math.min(MAX_DAY, Math.round(day)));
      const state = get();
      if (state.mode === "live") {
        if (!ENGINE_URL) return;
        void fetch(`${ENGINE_URL}/clock/advance`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ to_day: clamped }) }).catch((err: unknown) =>
          console.warn("palace: clock/advance failed", err),
        );
        return;
      }
      if (clamped === state.snapshot.day) return;
      const result = sweepSnapshot(state.snapshot, clamped, {
        texture: fixtureTexture(state.seed),
        eventId: () => `syn_${(syntheticCounter++).toString(36).padStart(6, "0")}`,
        now: () => new Date().toISOString(),
      });
      set({
        snapshot: result.snapshot,
        layout: result.membershipChanged || clamped !== state.snapshot.day ? computeLayout(result.snapshot) : state.layout,
        recentEvents: pushEvents(state.recentEvents, result.events),
      });
    },

    select: (id) => set({ selectedId: id }),
    hover: (id) => set({ hoveredId: id }),

    editBelief(id, text) {
      const state = get();
      const belief = state.snapshot.beliefs.find((b) => b.id === id);
      if (!belief) return;
      const trimmed = text.trim();
      if (!trimmed || trimmed === belief.text) return;
      if (state.mode === "live") console.warn("palace: live editBelief is a stub; applying locally");
      state.applyEvent({ ...syntheticEnvelope(state.snapshot.day), type: "belief.updated", payload: { belief_id: id, text: trimmed, confidence: Math.max(belief.confidence, 0.9), by: "maya" } });
    },

    deleteBelief(id) {
      const state = get();
      const belief = state.snapshot.beliefs.find((b) => b.id === id);
      if (!belief) return;
      if (state.mode === "live") console.warn("palace: live deleteBelief is a stub; applying locally");
      const others = new Set(state.snapshot.beliefs.filter((b) => b.id !== id && b.status !== "tombstoned").flatMap((b) => b.evidence));
      const orphaned = belief.evidence.filter((c) => !others.has(c));
      state.applyEvent({ ...syntheticEnvelope(state.snapshot.day), type: "belief.tombstoned", payload: { belief_id: id, captures_deleted: orphaned } });
    },

    setControlsMode: (m) => set({ controlsMode: m }),
    setPointerLocked: (pointerLocked) => {
      if (get().pointerLocked !== pointerLocked) set({ pointerLocked });
    },

    setPlaying(playing) {
      set({ playing });
      if (get().mode !== "fixture") return;
      if (playing) ticker?.start();
      else ticker?.stop();
    },

    connect() {
      get().disconnect();
      const mode = detectMode();
      if (mode === "fixture") {
        const seed = seedFromLocation();
        const snapshot = generateFixture(seed);
        set({ mode, seed, snapshot, layout: computeLayout(snapshot), connection: "open", recentEvents: [], pulses: {} });
        ticker = createTicker(seed, () => get().snapshot, (e) => get().applyEvent(e));
        if (get().playing) ticker.start();
        return;
      }
      set({ mode, connection: "connecting" });
      if (typeof window === "undefined" || !WS_URL) return;
      const ws = new WebSocket(WS_URL);
      socket = ws;
      // Frames that arrive before GET /snapshot has been applied are held and replayed afterwards,
      // otherwise the snapshot would wipe out whatever they changed.
      const held: WsEvent[] = [];
      let holding = ENGINE_URL !== undefined;
      const release = () => {
        if (!holding) return;
        holding = false;
        const replay = held.splice(0, held.length);
        if (socket !== ws) return;
        for (const e of replay) get().applyEvent(e);
      };
      if (ENGINE_URL) {
        void fetch(`${ENGINE_URL}/snapshot?condition=cortex`)
          .then((r) => r.json())
          .then((json: unknown) => {
            if (socket !== ws) return;
            const parsed = WsEvent.safeParse(json);
            if (parsed.success) get().applyEvent(parsed.data);
            else console.warn("palace: /snapshot did not parse", parsed.error.message);
          })
          .catch((err: unknown) => console.warn("palace: /snapshot failed", err))
          .finally(release);
      }
      ws.onopen = () => set({ connection: "open" });
      ws.onclose = () => {
        if (socket === ws) set({ connection: "closed" });
      };
      ws.onerror = () => set({ connection: "closed" });
      ws.onmessage = (msg: MessageEvent<string>) => {
        let json: unknown;
        try {
          json = JSON.parse(msg.data);
        } catch {
          console.warn("palace: non-JSON WebSocket frame");
          return;
        }
        const parsed = WsEvent.safeParse(json);
        if (!parsed.success) {
          console.warn("palace: unknown event", (json as { type?: WsEventType } | null)?.type, parsed.error.message);
          return;
        }
        if (holding) held.push(parsed.data);
        else get().applyEvent(parsed.data);
      };
    },

    disconnect() {
      get().stopReplay();
      ticker?.stop();
      ticker = null;
      if (socket) {
        const ws = socket;
        socket = null;
        ws.close();
      }
      set({ connection: "closed" });
    },

    async startReplay(opts = {}) {
      const url = opts.url ?? DEFAULT_REPLAY_URL;
      const fresh = opts.fresh ?? true;
      get().stopReplay();
      const run = ++replayRun;
      set({ replay: { status: "loading", played: 0, total: 0 } });
      let text: string;
      try {
        const res = await fetch(url);
        if (!res.ok) throw new Error(`${res.status}`);
        text = await res.text();
      } catch (err) {
        if (run !== replayRun) return;
        set({ replay: { status: "idle", played: 0, total: 0 } });
        get().toast(`replay log unavailable (${url})`);
        console.warn("palace: replay fetch failed", err);
        return;
      }
      if (run !== replayRun) return;
      const { events, dropped } = parseEventLog(text);
      if (dropped) console.warn(`palace: replay dropped ${dropped} invalid line(s)`);
      if (events.length === 0) {
        set({ replay: { status: "idle", played: 0, total: 0 } });
        get().toast("replay log is empty");
        return;
      }
      // The fixture ticker would keep mutating fixture ids under the replay; pause it for the run.
      ticker?.stop();
      if (fresh) {
        const day = events[0]?.day ?? 2;
        const snapshot = emptySnapshot(day);
        set({ snapshot, layout: computeLayout(snapshot), recentEvents: [], pulses: {}, selectedId: null, hoveredId: null });
      }
      let played = 0;
      const total = events.length;
      set({ replay: { status: "playing", played, total } });
      const handle = createReplay(
        events,
        (e) => {
          if (run !== replayRun) return;
          get().applyEvent(e);
          played += 1;
          set({ replay: { status: played >= total ? "done" : "playing", played, total } });
          if (played >= total) replayHandle = null;
        },
        REPLAY_TIMING,
      );
      replayHandle = handle;
      handle.start();
    },

    stopReplay() {
      replayRun += 1;
      if (replayHandle) {
        replayHandle.stop();
        replayHandle = null;
      }
      const r = get().replay;
      if (r.status === "playing" || r.status === "loading") set({ replay: { status: "idle", played: r.played, total: r.total } });
    },

    toast(text) {
      const id = ++toastCounter;
      set({ toasts: [...get().toasts, { id, text }].slice(-3) });
      setTimeout(() => get().dismissToast(id), TOAST_MS);
    },

    dismissToast(id) {
      const toasts = get().toasts;
      if (toasts.some((t) => t.id === id)) set({ toasts: toasts.filter((t) => t.id !== id) });
    },

    setPendingDrafts: (pendingDrafts) => set({ pendingDrafts, drafts: get().drafts.filter((d) => pendingDrafts.includes(d.draft_id)) }),
    removeDraft: (id) => set({ drafts: get().drafts.filter((d) => d.draft_id !== id), pendingDrafts: get().pendingDrafts.filter((x) => x !== id) }),
    setBrowserOpen: (browserOpen) => set({ browserOpen }),
    setWorkflowScore: (workflowScore) => set({ workflowScore }),
    setFallbackOpen: (fallbackOpen) => set({ fallbackOpen }),
  };
});

function exists(snapshot: PalaceSnapshot, id: string): boolean {
  return snapshot.beliefs.some((b) => b.id === id) || snapshot.captures.some((c) => c.id === id) || snapshot.procedures.some((p) => p.id === id);
}

// ---------------------------------------------------------------------------
// Selectors and hooks
// ---------------------------------------------------------------------------

export const palaceStore = usePalaceStore;

export const useSnapshot = (): PalaceSnapshot => usePalaceStore((s) => s.snapshot);
export const useLayout = (): PalaceLayout => usePalaceStore((s) => s.layout);
export const useDay = (): number => usePalaceStore((s) => s.snapshot.day);
export const useBytes = (): PalaceSnapshot["bytes"] => usePalaceStore((s) => s.snapshot.bytes);
export const useBeliefs = (): PalaceBelief[] => usePalaceStore((s) => s.snapshot.beliefs);
export const useCaptures = (): PalaceCapture[] => usePalaceStore((s) => s.snapshot.captures);
export const useProcedures = (): PalaceProcedure[] => usePalaceStore((s) => s.snapshot.procedures);
export const useEdges = (): PalaceSnapshot["edges"] => usePalaceStore((s) => s.snapshot.edges);
export const useBelief = (id: string | null): PalaceBelief | undefined => usePalaceStore((s) => (id ? s.snapshot.beliefs.find((b) => b.id === id) : undefined));
export const useCapture = (id: string | null): PalaceCapture | undefined => usePalaceStore((s) => (id ? s.snapshot.captures.find((c) => c.id === id) : undefined));
export const useProcedure = (id: string | null): PalaceProcedure | undefined => usePalaceStore((s) => (id ? s.snapshot.procedures.find((p) => p.id === id) : undefined));
export const usePlacement = (id: string): Placement | undefined => usePalaceStore((s) => s.layout.placements.get(id));
export const useSelectedId = (): string | null => usePalaceStore((s) => s.selectedId);
export const useHoveredId = (): string | null => usePalaceStore((s) => s.hoveredId);
/** True only for the selected object; objects use this so a selection change re-renders two of them, not all. */
export const useIsSelected = (id: string): boolean => usePalaceStore((s) => s.selectedId === id);
export const useIsHovered = (id: string): boolean => usePalaceStore((s) => s.hoveredId === id);
/** Timestamp (ms) of the last pulse for `id`, or 0. */
export const usePulse = (id: string): number => usePalaceStore((s) => s.pulses[id] ?? 0);
export const useRecentEvents = (): WsEvent[] => usePalaceStore((s) => s.recentEvents);
export const useConnection = (): { mode: PalaceMode; connection: ConnectionState } => usePalaceStore(useShallow((s) => ({ mode: s.mode, connection: s.connection })));
export const useControlsMode = (): ControlsMode => usePalaceStore((s) => s.controlsMode);
export const usePointerLocked = (): boolean => usePalaceStore((s) => s.pointerLocked);
export const usePlaying = (): boolean => usePalaceStore((s) => s.playing);
export const useReplay = (): ReplayState => usePalaceStore((s) => s.replay);
export const useToasts = (): Toast[] => usePalaceStore((s) => s.toasts);
export const useWorkflowScore = (): WorkflowScore | null => usePalaceStore((s) => s.workflowScore);
export const useFallbackOpen = (): boolean => usePalaceStore((s) => s.fallbackOpen);
export const useDrafts = (): AgentDraft[] => usePalaceStore((s) => s.drafts);
export const useBrowserOpen = (): boolean => usePalaceStore((s) => s.browserOpen);
/** Stable action bundle; safe to destructure in components. */
export const usePalaceActions = () =>
  usePalaceStore(
    useShallow((s) => ({
      applyEvent: s.applyEvent,
      setDay: s.setDay,
      select: s.select,
      hover: s.hover,
      editBelief: s.editBelief,
      deleteBelief: s.deleteBelief,
      setControlsMode: s.setControlsMode,
      setPointerLocked: s.setPointerLocked,
      setPlaying: s.setPlaying,
      connect: s.connect,
      disconnect: s.disconnect,
      startReplay: s.startReplay,
      stopReplay: s.stopReplay,
      toast: s.toast,
      setFallbackOpen: s.setFallbackOpen,
      removeDraft: s.removeDraft,
      setBrowserOpen: s.setBrowserOpen,
    })),
  );

/** Evidence captures of a belief, for the HUD card thumbnails. */
export function evidenceOf(snapshot: PalaceSnapshot, belief: PalaceBelief): PalaceCapture[] {
  const byId = new Map(snapshot.captures.map((c) => [c.id, c]));
  return belief.evidence.map((id) => byId.get(id)).filter((c): c is PalaceCapture => c !== undefined);
}
