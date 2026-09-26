/**
 * Shared between main, preload and renderer: IPC channel names, the events the mascot reacts to,
 * and the `window.mascot` bridge the preload script exposes.
 */
import type { AskResponse, WsEvent } from "@cortex/schema";

export const IPC = {
  drag: "mascot:drag",
  cursor: "mascot:cursor",
  ask: "mascot:ask",
  saveMemory: "mascot:save-memory",
  listMemories: "mascot:list-memories",
  retryMemory: "mascot:retry-memory",
  transcribe: "mascot:transcribe",
  realtimeToken: "mascot:realtime-token",
  synthesize: "mascot:synthesize",
  setClickThrough: "mascot:set-click-through",
  event: "mascot:event",
  /** Main -> renderer: the global shortcut (Option+V / Alt+V) asked the pet to start listening. */
  startListening: "mascot:start-listening",
} as const;

/** Electron accelerator for "talk to Cortex". Option+V on macOS, Alt+V elsewhere. */
export const LISTEN_SHORTCUT = "Alt+V";

/** Engine WebSocket event types forwarded from main to the renderer. */
export const FORWARDED_EVENT_TYPES = ["belief.recalled", "belief.forgotten", "clock.advanced", "voice.received"] as const;
export type ForwardedEventType = (typeof FORWARDED_EVENT_TYPES)[number];
export type MascotEvent = Extract<WsEvent, { type: ForwardedEventType }>;

export interface MemoryNote {
  id: string;
  text: string;
  createdAt: string;
  status: "pending" | "synced";
  error?: string;
}

export interface MascotBridge {
  setDragging?(active: boolean): void;
  onCursor?(cb: (point: { x: number; y: number }) => void): () => void;
  realtimeToken(): Promise<string>;
  synthesize(text: string): Promise<Uint8Array>;
  saveMemory(text: string): Promise<MemoryNote>;
  listMemories(): Promise<MemoryNote[]>;
  retryMemory(id: string): Promise<MemoryNote>;
  transcribe(bytes: Uint8Array, mime: string): Promise<string>;
  /** Ask the engine. Main performs the HTTP call and validates the response. */
  ask(text: string, opts?: { speak?: boolean }): Promise<AskResponse>;
  /** When true, mouse events pass through the transparent window to whatever is below. */
  setClickThrough(enabled: boolean): void;
  /** Subscribe to forwarded engine events. Returns an unsubscribe function. */
  onEvent(cb: (event: MascotEvent) => void): () => void;
  /** Fires when the user presses the global listen shortcut. Returns an unsubscribe function. */
  onStartListening(cb: () => void): () => void;
}

declare global {
  interface Window {
    mascot: MascotBridge;
  }
}
