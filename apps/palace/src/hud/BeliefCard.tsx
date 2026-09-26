"use client";
/** Shows the selected belief; renders nothing when the selection is not a belief. */
import { useBelief, useSelectedId } from "@/lib/store";
import { BeliefCardBody } from "./BeliefCardBody";

export function BeliefCard() {
  const selectedId = useSelectedId();
  const belief = useBelief(selectedId);
  if (!belief) return null;
  // Keyed so edit / delete drafts reset when the selection changes.
  return <BeliefCardBody key={belief.id} belief={belief} />;
}
