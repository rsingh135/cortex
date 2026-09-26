/**
 * The agent's 2D map: the ~500-token view it reads before recalling anything.
 * Active beliefs only, per condition. docs/contracts.md > GET /map.
 *
 * Mirrors apps/palace/src/lib/map.ts so the agent and the palace describe the same memory.
 * Recent changes come from belief history, which the ledger already carries; the engine
 * needs no event buffer to answer this route.
 */
import { MapResponse, ROOMS, type Condition, type Room } from "@cortex/schema";
import type { MemoryData } from "../db/memory-data.js";

export const MAP_TOP_BELIEFS = 4;
export const MAP_RECENT_CHANGES = 8;
export const MAP_TEXT_LIMIT = 60;

/** Same rule as the palace's format.truncate, so both surfaces cut text identically. */
function truncate(text: string, max = MAP_TEXT_LIMIT): string {
  if (text.length <= max) return text;
  return `${text.slice(0, Math.max(0, max - 1)).trimEnd()}…`;
}

const order = (a: string, b: string) => (a < b ? -1 : a > b ? 1 : 0);

export function buildAgentMap(data: MemoryData, condition: Condition) {
  const beliefById = new Map(data.beliefs.map((b) => [b._id, b]));
  /** Beliefs the agent may act on: visible in this condition and already created by today. */
  const active = data.beliefStates.flatMap((state) => {
    if (state.condition !== condition) return [];
    if (state.status !== "active" && state.status !== "cracked") return [];
    const belief = beliefById.get(state.belief_id);
    if (!belief || belief.created_day > data.day) return [];
    return [{ belief, confidence: state.confidence }];
  });

  const rooms = ROOMS.map((name: Room) => {
    const inRoom = active.filter((entry) => entry.belief.room === name);
    const procedures = data.procedures.filter((p) => p.room === name);
    return {
      name,
      beliefs: inRoom.length,
      procedures: procedures
        .filter((p) => p.status === "active")
        .map((p) => p.name),
      top: [...inRoom]
        .sort(
          (a, b) =>
            b.confidence - a.confidence || order(a.belief._id, b.belief._id),
        )
        .slice(0, MAP_TOP_BELIEFS)
        .map((entry) => truncate(entry.belief.text)),
      cracked: procedures
        .filter((p) => p.status === "cracked")
        .map((p) => p.name),
    };
  });

  // Newest first across every visible belief's history; ties break on id for a stable map.
  const visible = new Set(active.map((entry) => entry.belief._id));
  const recent_changes = data.beliefs
    .filter((belief) => visible.has(belief._id))
    .flatMap((belief) =>
      belief.history.map((entry) => ({ belief, ...entry })),
    )
    .sort(
      (a, b) => b.day - a.day || order(a.belief._id, b.belief._id),
    )
    .slice(0, MAP_RECENT_CHANGES)
    .map(
      (entry) =>
        `Day ${entry.day}: ${entry.event} — ${truncate(entry.note ?? entry.belief.text)}`,
    );

  return MapResponse.parse({ day: data.day, rooms, recent_changes });
}
