"use client";
/**
 * Room names twice over: lettered above each door on the atrium side, facing the atrium centre, and
 * lying flat on the floor just inside the door so a room reads from above (orbit view) and on entry.
 */
import { Text } from "@react-three/drei";
import { useMemo } from "react";
import { DOOR_HEIGHT, roomLocalToWorld, roomRotationY } from "@/lib/layout";
import { useLayout } from "@/lib/store";
import { WALL_THICKNESS, doorways } from "./geometry";
import { PALETTE } from "./materials";

const LABEL_LIFT = 0.55;
const LABEL_SIZE = 0.38;
const FLOOR_LABEL_SIZE = 1.2;
/** Floor lettering sits between the door and the first pedestal row (pedestals start 2 m in). */
const FLOOR_LABEL_INSET = 1.15;
const FLOOR_LABEL_LIFT = 0.012;

export interface RoomLabelsProps {
  /** Font URL for drei `<Text>`; without it troika fetches its default font from a CDN. */
  font?: string;
}

export function RoomLabels({ font }: RoomLabelsProps) {
  const layout = useLayout();
  const ways = useMemo(() => doorways(layout), [layout]);
  const rooms = useMemo(() => [...layout.rooms, layout.archive], [layout]);
  const inset = WALL_THICKNESS / 2 + 0.02;
  return (
    <group>
      {ways.map((d) => (
        <Text
          key={d.room}
          position={[d.outer[0] - d.direction[0] * inset, DOOR_HEIGHT + LABEL_LIFT, d.outer[2] - d.direction[1] * inset]}
          rotation-y={roomRotationY(d.room)}
          fontSize={LABEL_SIZE}
          letterSpacing={0.14}
          color={PALETTE.lettering}
          anchorX="center"
          anchorY="middle"
          font={font}
          characters={d.room.toUpperCase()}
        >
          {d.room.toUpperCase()}
        </Text>
      ))}
      {rooms.map((room) => (
        <Text
          key={`${room.room}-floor`}
          position={roomLocalToWorld(room, [0, FLOOR_LABEL_LIFT, room.size[1] / 2 - FLOOR_LABEL_INSET])}
          rotation={[-Math.PI / 2, room.rotationY, 0, "YXZ"]}
          fontSize={FLOOR_LABEL_SIZE}
          letterSpacing={0.08}
          color={PALETTE.lettering}
          fillOpacity={0.5}
          anchorX="center"
          anchorY="middle"
          font={font}
          characters={room.room.toUpperCase()}
        >
          {room.room.toUpperCase()}
        </Text>
      ))}
    </group>
  );
}
