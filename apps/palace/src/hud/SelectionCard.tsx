"use client";
/** The card for an object id: a belief, a procedure table or a painting. Nothing when the id is unknown. */
import { useCapture, useProcedure } from "@/lib/store";
import { BeliefCard } from "./BeliefCard";
import { CaptureCard } from "./CaptureCard";
import { ProcedureCard } from "./ProcedureCard";

export interface SelectionCardProps {
  id: string;
}

export function SelectionCard({ id }: SelectionCardProps) {
  const procedure = useProcedure(id);
  const capture = useCapture(id);
  if (procedure) return <ProcedureCard key={procedure.id} procedure={procedure} />;
  if (capture) return <CaptureCard key={capture.id} capture={capture} />;
  return <BeliefCard id={id} />;
}
