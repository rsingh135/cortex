"use client";
/** Shows a belief by id; renders nothing when the id is not a belief. */
import { useBelief } from "@/lib/store";
import { BeliefCardBody } from "./BeliefCardBody";

export interface BeliefCardProps {
  id: string;
}

export function BeliefCard({ id }: BeliefCardProps) {
  const belief = useBelief(id);
  if (!belief) return null;
  // Keyed so edit / delete drafts reset when the selection changes.
  return <BeliefCardBody key={belief.id} belief={belief} />;
}
