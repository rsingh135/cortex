/**
 * The agent's 2D map: a compact floor plan of the memory the model reads before recalling anything.
 * docs/spec.md > The palace and the agent's map > The agent's 2D map. About 500 tokens regardless of size.
 */
import { MapResponse, ROOMS, type Condition } from "@cortex/schema";
import type { MemoryData } from "../db/memory-data.js";

const TOP_PER_ROOM = 4;
const RECENT = 8;

export function buildMap(data: MemoryData, condition: Condition) {
  const states = data.beliefStates.filter((s) => s.condition === condition && (s.status === "active" || s.status === "cracked"));
  const byId = new Map(data.beliefs.map((b) => [b._id, b]));
  const rooms = ROOMS.map((name) => {
    const here = states
      .flatMap((s) => {
        const b = byId.get(s.belief_id);
        return b && b.room === name ? [{ b, s }] : [];
      })
      .sort((x, y) => y.s.confidence - x.s.confidence || (x.b.text < y.b.text ? -1 : 1));
    const procedures = data.procedures.filter((p) => p.room === name);
    return {
      name,
      beliefs: here.length,
      procedures: procedures.map((p) => p.name),
      top: here.slice(0, TOP_PER_ROOM).map(({ b }) => b.text),
      cracked: procedures.filter((p) => p.status === "cracked").map((p) => p.name),
    };
  }).filter((room) => room.beliefs > 0 || room.procedures.length > 0);
  const recent = states
    .flatMap((s) => {
      const b = byId.get(s.belief_id);
      return b ? [b] : [];
    })
    .sort((a, b) => b.created_day - a.created_day || (a._id < b._id ? 1 : -1))
    .slice(0, RECENT)
    .map((b) => `Day ${b.created_day}: ${b.text}`);
  return MapResponse.parse({ day: data.day, rooms, recent_changes: recent });
}

/** The map as the model sees it. */
export function mapAsText(map: ReturnType<typeof buildMap>): string {
  return JSON.stringify(map);
}
