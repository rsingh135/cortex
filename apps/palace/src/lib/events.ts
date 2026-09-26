/** One-line, human descriptions of WsEvents for the HUD ticker and the agent map's recent_changes. */
import type { WsEvent } from "@cortex/schema";
import { formatBytes, truncate } from "./format";
import type { PalaceSnapshot } from "./types";

export interface EventLookup {
  beliefText(id: string): string;
  captureTitle(id: string): string;
  procedureName(id: string): string;
}

export function lookupFor(snapshot: PalaceSnapshot): EventLookup {
  const beliefs = new Map(snapshot.beliefs.map((b) => [b.id, b.text]));
  const captures = new Map(snapshot.captures.map((c) => [c.id, c.title]));
  const procedures = new Map(snapshot.procedures.map((p) => [p.id, p.name]));
  return {
    beliefText: (id) => truncate(beliefs.get(id) ?? "a belief", 48),
    captureTitle: (id) => truncate(captures.get(id) ?? "a screenshot", 40),
    procedureName: (id) => procedures.get(id) ?? "a procedure",
  };
}

export function describeEvent(e: WsEvent, lookup: EventLookup): string {
  switch (e.type) {
    case "capture.created":
      return `Captured "${truncate(e.payload.title, 40)}"`;
    case "capture.recalled":
      return `Re-sharpened ${lookup.captureTitle(e.payload.capture_id)} (${e.payload.ceiling ?? "gone"})`;
    case "level.deleted":
      return e.payload.ceiling === null
        ? `Forgot ${lookup.captureTitle(e.payload.capture_id)} (${formatBytes(e.payload.bytes_freed)} freed)`
        : `Dropped ${e.payload.levels.join(", ")} of ${lookup.captureTitle(e.payload.capture_id)} (${formatBytes(e.payload.bytes_freed)} freed)`;
    case "belief.created":
      return `New ${e.payload.kind} in ${e.payload.room}: ${truncate(e.payload.text, 48)}`;
    case "belief.reinforced":
      return `Reinforced "${lookup.beliefText(e.payload.belief_id)}" to ${e.payload.confidence.toFixed(2)}`;
    case "belief.recalled":
      return `Recalled "${lookup.beliefText(e.payload.belief_id)}" (${e.payload.reason})`;
    case "belief.updated":
      return `${e.payload.by === "maya" ? "Maya" : e.payload.by === "agent" ? "Agent" : "Sweep"} updated "${truncate(e.payload.text, 48)}"`;
    case "belief.superseded":
      return `Superseded "${lookup.beliefText(e.payload.belief_id)}"`;
    case "belief.tombstoned":
      return `Deleted "${lookup.beliefText(e.payload.belief_id)}" and ${e.payload.captures_deleted.length} screenshots`;
    case "belief.forgotten":
      return `Forgot "${lookup.beliefText(e.payload.belief_id)}" in ${e.payload.room}`;
    case "edge.created":
      return `Linked ${e.payload.type.replace("_", " ")}: ${lookup.beliefText(e.payload.from)}`;
    case "procedure.created":
      return `Learned procedure ${e.payload.name} in ${e.payload.room}`;
    case "procedure.cracked":
      return `${lookup.procedureName(e.payload.procedure_id)} cracked by "${lookup.beliefText(e.payload.by_belief_id)}"`;
    case "procedure.healed":
      return `${lookup.procedureName(e.payload.procedure_id)} healed`;
    case "procedure.step":
      return `${lookup.procedureName(e.payload.procedure_id)} step ${e.payload.step}: ${e.payload.do}`;
    case "clock.advanced":
      return `Day ${e.payload.to_day}: ${e.payload.levels_deleted} levels dropped, ${formatBytes(e.payload.bytes_freed)} freed, ${e.payload.captures_forgotten} screenshots forgotten`;
    case "voice.received":
      return `Voice note: "${truncate(e.payload.transcript, 48)}"`;
    case "agent.drafts":
      return `Agent drafted ${e.payload.drafts.length} landlord message${e.payload.drafts.length === 1 ? "" : "s"}, waiting for approval`;
    case "agent.draft_sent":
      return `Message sent to landlord (${e.payload.draft_id})`;
    case "snapshot":
      return `Snapshot: ${e.payload.beliefs.length} beliefs, ${e.payload.captures.length} captures`;
  }
}
