/**
 * In-memory record of Maya's and the agent's actions in the mock world. Resets on restart.
 * TODO(engine): replace with writes to the Atlas `messages` collection (and a `rejections`
 * log) so the inbox survives restarts and the engine's change stream sees them.
 */
import type { Message } from "@cortex/schema";

export interface Rejection {
  listing_id: string;
  at: string;
}

interface WorldState {
  rejections: Rejection[];
  messages: Message[];
  counter: number;
}

const globalKey = "__cortex_world_store__";
const g = globalThis as typeof globalThis & { [globalKey]?: WorldState };
const state: WorldState = g[globalKey] ?? { rejections: [], messages: [], counter: 0 };
g[globalKey] = state;

export function nextId(prefix: string): string {
  state.counter += 1;
  return `${prefix}_${state.counter.toString(36).padStart(6, "0")}`;
}

export function addRejection(listingId: string): Rejection {
  const r: Rejection = { listing_id: listingId, at: new Date().toISOString() };
  state.rejections.push(r);
  return r;
}

export function addMessage(m: Message): Message {
  state.messages.push(m);
  return m;
}

export function landlordThreads(): Message[] {
  return state.messages.filter((m) => m.kind === "landlord_chat");
}

export function messagesForThread(threadId: string): Message[] {
  return state.messages.filter((m) => m.thread_id === threadId);
}

export function rejectionsFor(listingId: string): Rejection[] {
  return state.rejections.filter((r) => r.listing_id === listingId);
}

/** Test-only reset. */
export function resetWorldStore(): void {
  state.rejections = [];
  state.messages = [];
  state.counter = 0;
}
