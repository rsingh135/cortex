/**
 * Groups the layout's placements by what renders them. Pure; runs once per snapshot change.
 */
import type { PalaceLayout, PalaceSnapshot, Placement } from "@/lib/types";
import { isGold } from "./anchors";
import type { PedestalSpec } from "./Pedestal";

export interface Placed {
  id: string;
  placement: Placement;
}

export interface CollectedObjects {
  pedestals: PedestalSpec[];
  beliefs: Placed[];
  /** Captures with a texture ceiling; rendered as paintings. */
  paintings: Placed[];
  /** Captures whose every level is gone; rendered as empty frames. */
  forgotten: Placed[];
  procedures: Placed[];
  archived: Placed[];
}

export function collectObjects(snapshot: PalaceSnapshot, layout: PalaceLayout): CollectedObjects {
  const beliefById = new Map(snapshot.beliefs.map((b) => [b.id, b]));
  const captureById = new Map(snapshot.captures.map((c) => [c.id, c]));
  const procedureIds = new Set(snapshot.procedures.map((p) => p.id));
  const out: CollectedObjects = { pedestals: [], beliefs: [], paintings: [], forgotten: [], procedures: [], archived: [] };

  for (const placement of layout.placements.values()) {
    const placed: Placed = { id: placement.id, placement };
    switch (placement.kind) {
      case "belief": {
        const belief = beliefById.get(placement.id);
        if (!belief) continue;
        out.beliefs.push(placed);
        out.pedestals.push({ id: placement.id, position: placement.position, rotationY: placement.rotationY, gold: isGold(belief) });
        break;
      }
      case "painting": {
        const capture = captureById.get(placement.id);
        if (!capture) continue;
        (capture.ceiling === null ? out.forgotten : out.paintings).push(placed);
        break;
      }
      case "procedure":
        if (procedureIds.has(placement.id)) out.procedures.push(placed);
        break;
      case "archive":
        if (beliefById.has(placement.id)) out.archived.push(placed);
        break;
    }
  }
  return out;
}
