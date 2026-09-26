"use client";
/** The building: atrium floor, ceiling ring with skylight, every wall and lintel, room floors, lettering, clickable doorways. */
import { useMemo } from "react";
import { useLayout } from "@/lib/store";
import { AtriumCeiling } from "./AtriumCeiling";
import { AtriumFloor } from "./AtriumFloor";
import { Doorways } from "./Doorways";
import { buildWalls } from "./geometry";
import { RoomFloors } from "./RoomFloors";
import { RoomLabels } from "./RoomLabels";
import { WallSegments } from "./WallSegments";

export interface ArchitectureProps {
  /** Font URL for the room lettering. */
  font?: string;
}

export function Architecture({ font }: ArchitectureProps) {
  const layout = useLayout();
  const walls = useMemo(() => buildWalls(layout), [layout]);
  return (
    <group>
      <AtriumFloor />
      <AtriumCeiling />
      <RoomFloors />
      <WallSegments walls={walls} />
      <RoomLabels font={font} />
      <Doorways />
    </group>
  );
}
