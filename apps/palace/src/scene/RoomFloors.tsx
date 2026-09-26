"use client";
/** Pale oak floors for the six rooms and the archive alcove. Each room is a group in room-local space. */
import { useMemo } from "react";
import { useLayout } from "@/lib/store";
import { WALL_THICKNESS } from "./geometry";
import { getMaterials } from "./materials";

export function RoomFloors() {
  const layout = useLayout();
  const { oak } = getMaterials();
  const rooms = useMemo(() => [...layout.rooms, layout.archive], [layout]);
  return (
    <group>
      {rooms.map((room) => (
        <group key={room.room} position={room.center} rotation-y={room.rotationY}>
          <mesh material={oak} rotation-x={-Math.PI / 2} receiveShadow>
            <planeGeometry args={[room.size[0] + WALL_THICKNESS, room.size[1] + WALL_THICKNESS]} />
          </mesh>
        </group>
      ))}
    </group>
  );
}
