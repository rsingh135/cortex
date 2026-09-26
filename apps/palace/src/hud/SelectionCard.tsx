"use client";
/** The card for whatever is selected: a belief, a procedure table or a painting. Nothing when nothing is. */
import { useCapture, useProcedure, useSelectedId } from "@/lib/store";
import { BeliefCard } from "./BeliefCard";
import { CaptureCard } from "./CaptureCard";
import { ProcedureCard } from "./ProcedureCard";

export function SelectionCard() {
  const selectedId = useSelectedId();
  const procedure = useProcedure(selectedId);
  const capture = useCapture(selectedId);
  if (procedure) return <ProcedureCard key={procedure.id} procedure={procedure} />;
  if (capture) return <CaptureCard key={capture.id} capture={capture} />;
  return <BeliefCard />;
}
