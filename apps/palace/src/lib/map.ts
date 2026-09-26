/**
 * The agent's 2D map: the ~500-token JSON it reads before recalling anything. Active beliefs only.
 */
import { MapResponse, ROOMS, type WsEvent } from "@cortex/schema";
import { describeEvent, lookupFor } from "./events";
import { truncate } from "./format";
import type { PalaceSnapshot } from "./types";

export const MAP_TOP_BELIEFS = 4;
export const MAP_RECENT_CHANGES = 8;

export function buildAgentMap(snapshot: PalaceSnapshot, recentEvents: readonly WsEvent[] = []): MapResponse {
  const lookup = lookupFor(snapshot);
  const active = snapshot.beliefs.filter((b) => (b.status === "active" || b.status === "cracked") && b.createdDay <= snapshot.day);
  const rooms = ROOMS.map((name) => {
    const beliefs = active.filter((b) => b.room === name);
    const procedures = snapshot.procedures.filter((p) => p.room === name);
    return {
      name,
      beliefs: beliefs.length,
      procedures: procedures.map((p) => p.name),
      top: [...beliefs]
        .sort((a, b) => b.confidence - a.confidence || (a.id < b.id ? -1 : 1))
        .slice(0, MAP_TOP_BELIEFS)
        .map((b) => truncate(b.text, 60)),
      cracked: procedures.filter((p) => p.status === "cracked").map((p) => p.name),
    };
  });
  const recent_changes = recentEvents
    .filter((e) => e.type !== "snapshot")
    .slice(0, MAP_RECENT_CHANGES)
    .map((e) => describeEvent(e, lookup));
  return MapResponse.parse({ day: snapshot.day, rooms, recent_changes });
}

export function agentMapJson(snapshot: PalaceSnapshot, recentEvents: readonly WsEvent[] = []): string {
  return JSON.stringify(buildAgentMap(snapshot, recentEvents), null, 2);
}
