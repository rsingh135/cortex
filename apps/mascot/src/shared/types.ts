/**
 * Shared between main, preload and renderer: IPC channel names, the events the mascot reacts to,
 * and the `window.mascot` bridge the preload script exposes.
 */
import type { AskResponse, WsEvent } from "@cortex/schema";

export const IPC = {
  ask: "mascot:ask",
  setClickThrough: "mascot:set-click-through",
  event: "mascot:event",
} as const;

/** Engine WebSocket event types forwarded from main to the renderer. */
export const FORWARDED_EVENT_TYPES = ["belief.recalled", "belief.forgotten", "clock.advanced", "voice.received"] as const;
export type ForwardedEventType = (typeof FORWARDED_EVENT_TYPES)[number];
export type MascotEvent = Extract<WsEvent, { type: ForwardedEventType }>;

export interface MascotBridge {
  /** Ask the engine. Main performs the HTTP call and validates the response. */
  ask(text: string, opts?: { speak?: boolean }): Promise<AskResponse>;
  /** When true, mouse events pass through the transparent window to whatever is below. */
  setClickThrough(enabled: boolean): void;
  /** Subscribe to forwarded engine events. Returns an unsubscribe function. */
  onEvent(cb: (event: MascotEvent) => void): () => void;
}

declare global {
  interface Window {
    mascot: MascotBridge;
  }
}
