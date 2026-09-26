/**
 * Renderer state: what the pet is doing, the transcript, and the last answer.
 * `reduce` is pure so state transitions can be unit-tested; the zustand store just wraps it.
 */
import { create } from "zustand";
import type { AskResponse } from "@cortex/schema";
import type { MascotEvent } from "../../shared/types";

export type PetState = "idle" | "listening" | "thinking" | "speaking" | "reacting";
export type Reaction = "nod" | "shiver" | null;

export interface Turn {
  role: "user" | "mascot";
  text: string;
  cited?: number;
}

export interface MascotState {
  pet: PetState;
  reaction: Reaction;
  transcript: Turn[];
  lastAnswer: AskResponse | null;
  error: string | null;
}

export type Action =
  | { type: "listen" }
  | { type: "stopListening" }
  | { type: "asked"; text: string }
  | { type: "answered"; response: AskResponse }
  | { type: "failed"; message: string }
  | { type: "doneSpeaking" }
  | { type: "engineEvent"; event: MascotEvent }
  | { type: "reactionDone" };

export const initialState: MascotState = {
  pet: "idle",
  reaction: null,
  transcript: [],
  lastAnswer: null,
  error: null,
};

const MAX_TURNS = 20;

export function reduce(state: MascotState, action: Action): MascotState {
  switch (action.type) {
    case "listen":
      return { ...state, pet: "listening", error: null };
    case "stopListening":
      return state.pet === "listening" ? { ...state, pet: "idle" } : state;
    case "asked":
      return {
        ...state,
        pet: "thinking",
        error: null,
        transcript: trim([...state.transcript, { role: "user", text: action.text }]),
      };
    case "answered":
      return {
        ...state,
        pet: "speaking",
        lastAnswer: action.response,
        transcript: trim([...state.transcript, { role: "mascot", text: action.response.answer, cited: action.response.cited.length }]),
      };
    case "failed":
      return { ...state, pet: "idle", error: action.message };
    case "doneSpeaking":
      return state.pet === "speaking" ? { ...state, pet: "idle" } : state;
    case "engineEvent": {
      // Never interrupt a conversation turn with a reaction.
      if (state.pet === "thinking" || state.pet === "speaking" || state.pet === "listening") return state;
      const reaction = reactionFor(action.event);
      if (!reaction) return state;
      return { ...state, pet: "reacting", reaction };
    }
    case "reactionDone":
      return state.pet === "reacting" ? { ...state, pet: "idle", reaction: null } : state;
  }
}

export function reactionFor(event: MascotEvent): Reaction {
  switch (event.type) {
    case "belief.recalled":
      return "nod";
    case "belief.forgotten":
      return "shiver";
    case "clock.advanced":
      return event.payload.beliefs_forgotten > 0 ? "shiver" : "nod";
    case "voice.received":
      return "nod";
  }
}

function trim(turns: Turn[]): Turn[] {
  return turns.length > MAX_TURNS ? turns.slice(turns.length - MAX_TURNS) : turns;
}

interface Store extends MascotState {
  dispatch(action: Action): void;
}

export const useMascotStore = create<Store>((set) => ({
  ...initialState,
  dispatch: (action) => set((state) => reduce(state, action)),
}));
