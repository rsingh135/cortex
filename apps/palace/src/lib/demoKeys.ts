/**
 * Demo hotkeys (docs/demo.md), as a pure key -> action mapper so the binding is testable without a DOM.
 * Tab / Esc / E belong to the scene controls and are never claimed here.
 */
export type DemoAction = "replay.start" | "replay.stop" | "journal" | "chart" | "fallback" | "voice" | "approve";

export interface KeyLike {
  key: string;
  shiftKey?: boolean;
  altKey?: boolean;
  ctrlKey?: boolean;
  metaKey?: boolean;
}

export const DEMO_KEYS: ReadonlyArray<{ keys: string; does: string }> = [
  { keys: "R", does: "replay day 2" },
  { keys: "Shift R", does: "stop replay" },
  { keys: "J", does: "dream journal" },
  { keys: "C", does: "chart" },
  { keys: "F", does: "fallback video" },
  { keys: "V", does: "voice fallback" },
  { keys: "A", does: "approve drafts" },
];

/** Null when the key is not a demo hotkey or a modifier other than Shift is held. */
export function demoActionFor(e: KeyLike): DemoAction | null {
  if (e.altKey || e.ctrlKey || e.metaKey) return null;
  switch (e.key.toLowerCase()) {
    case "r":
      return e.shiftKey ? "replay.stop" : "replay.start";
    case "j":
      return e.shiftKey ? null : "journal";
    case "c":
      return e.shiftKey ? null : "chart";
    case "f":
      return e.shiftKey ? null : "fallback";
    case "v":
      return e.shiftKey ? null : "voice";
    case "a":
      return e.shiftKey ? null : "approve";
    default:
      return null;
  }
}

/** True when the keystroke belongs to a text field, so hotkeys must stay out of the way. */
export function isTypingTarget(target: EventTarget | null): boolean {
  if (!target || typeof HTMLElement === "undefined" || !(target instanceof HTMLElement)) return false;
  const tag = target.tagName;
  return tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT" || target.isContentEditable;
}
