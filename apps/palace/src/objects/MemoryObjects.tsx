"use client";
/**
 * Everything the memory holds, at its layout placement: instanced pedestals with a belief on each,
 * paintings or empty frames on the walls, procedure tables, archive cases, and the threads between
 * them. Mount once inside the scene's `<Canvas>`.
 */
import { useMemo } from "react";
import { useLayout, useSnapshot } from "@/lib/store";
import { ArchiveCase } from "./ArchiveCase";
import { BeliefObject } from "./BeliefObject";
import { collectObjects } from "./collect";
import { EmptyFrame } from "./EmptyFrame";
import { Painting } from "./Painting";
import { Pedestals } from "./Pedestal";
import { ProcedureTable } from "./ProcedureTable";
import { Threads } from "./Threads";

export interface MemoryObjectsProps {
  /** Draw the threads between objects (default true). */
  showThreads?: boolean;
  /** Font URL passed to every drei `<Text>` (plaques, step cards). */
  font?: string;
}

export function MemoryObjects({ showThreads = true, font }: MemoryObjectsProps) {
  const snapshot = useSnapshot();
  const layout = useLayout();
  const objects = useMemo(() => collectObjects(snapshot, layout), [snapshot, layout]);

  return (
    <group name="memory-objects">
      <Pedestals pedestals={objects.pedestals} />
      {objects.beliefs.map(({ id, placement }) => (
        <BeliefObject key={id} id={id} placement={placement} />
      ))}
      {objects.paintings.map(({ id, placement }) => (
        <Painting key={id} id={id} placement={placement} />
      ))}
      {objects.forgotten.map(({ id, placement }) => (
        <EmptyFrame key={id} id={id} placement={placement} font={font} />
      ))}
      {objects.procedures.map(({ id, placement }) => (
        <ProcedureTable key={id} id={id} placement={placement} font={font} />
      ))}
      {objects.archived.map(({ id, placement }) => (
        <ArchiveCase key={id} id={id} placement={placement} font={font} />
      ))}
      {showThreads && <Threads />}
    </group>
  );
}
