"use client";
/**
 * SVG floor plan of the palace from the store's layout: the 12-sided atrium, six rooms, archive alcove,
 * doorways, room labels with belief counts, a badge on rooms with a cracked procedure, and a
 * you-are-here dot. SVG x is world x and SVG y is world z (looking down, +z toward the bottom).
 * Type and marks are sized in screen pixels (via `unitsPerPx`) so they read at any map size.
 */
import { useMemo } from "react";
import { DOOR_WIDTH, atriumPolygon, layoutExtent, roomAt, roomCorners, roomFront, type PalaceRoom } from "@/lib/layout";
import { useLayout, useSnapshot } from "@/lib/store";
import { isShownInRoom } from "@/lib/types";
import { MinimapRoom } from "./MinimapRoom";
import { usePlayerPosition } from "./playerPosition";

export interface MinimapProps {
  /** Rendered size in CSS pixels (square). */
  size?: number;
  /** World [x, z] of the player; when omitted the dot follows `setPlayerPosition`. */
  playerPosition?: [number, number] | null;
  onRoomClick?: (room: PalaceRoom) => void;
  className?: string;
  /** Show the room name / count labels (off for very small maps). */
  labels?: boolean;
}

/** Below this size the belief counts are dropped; the names alone fit. */
const COUNTS_MIN_SIZE = 200;
/** Screen-pixel sizes for type and marks. */
const PX = { name: 12, count: 10, atrium: 11, dot: 4, dotStroke: 1.2, heading: 9, wall: 1.2 } as const;

export function Minimap({ size = 220, playerPosition, onRoomClick, className = "", labels = true }: MinimapProps) {
  const layout = useLayout();
  const snapshot = useSnapshot();
  const tracked = usePlayerPosition();
  const player = playerPosition === undefined ? ([tracked.x, tracked.z] as [number, number]) : playerPosition;
  const yaw = playerPosition === undefined ? tracked.yaw : null;

  const extent = layoutExtent(layout);
  /** World meters per rendered pixel; multiply a pixel size by this to get SVG units. */
  const unitsPerPx = (2 * extent) / size;
  const counts = useMemo(() => {
    const map = new Map<PalaceRoom, number>();
    for (const b of snapshot.beliefs) {
      if (b.createdDay > snapshot.day) continue;
      if (isShownInRoom(b)) map.set(b.room, (map.get(b.room) ?? 0) + 1);
      else if (b.status === "superseded") map.set("Archive", (map.get("Archive") ?? 0) + 1);
    }
    return map;
  }, [snapshot]);
  const cracked = useMemo(() => new Set<PalaceRoom>(snapshot.procedures.filter((p) => p.status === "cracked").map((p) => p.room)), [snapshot.procedures]);
  const here = player ? roomAt(layout, [player[0], 0, player[1]]) : null;
  const rooms = [...layout.rooms, layout.archive];
  const atrium = useMemo(
    () =>
      atriumPolygon(layout.atriumRadius)
        .map(([x, z]) => `${x.toFixed(2)},${z.toFixed(2)}`)
        .join(" "),
    [layout.atriumRadius],
  );
  const showCounts = labels && size >= COUNTS_MIN_SIZE;
  // The dot already says "you are in the atrium"; the word would sit under it.
  const showAtriumLabel = labels && !player;

  return (
    <svg
      width={size}
      height={size}
      viewBox={`${-extent} ${-extent} ${2 * extent} ${2 * extent}`}
      role="img"
      aria-label={`Palace floor plan, ${snapshot.beliefs.filter((b) => isShownInRoom(b) && b.createdDay <= snapshot.day).length} beliefs across ${layout.rooms.length} rooms${here ? `, you are in ${here}` : ", you are in the atrium"}`}
      className={`select-none ${className}`}
    >
      <polygon points={atrium} className={`${here === null && player ? "fill-sky-200 stroke-sky-700" : "fill-white stroke-zinc-500"}`} strokeWidth={PX.wall * unitsPerPx} strokeLinejoin="round" />
      {showAtriumLabel && (
        <text x={0} y={0.35 * PX.atrium * unitsPerPx} textAnchor="middle" fontSize={PX.atrium * unitsPerPx} className="fill-zinc-400 font-medium uppercase" style={{ letterSpacing: 0.12 * PX.atrium * unitsPerPx }}>
          Atrium
        </text>
      )}
      {rooms.map((room) => (
        <MinimapRoom
          key={room.room}
          room={room}
          corners={roomCorners(room)}
          count={counts.get(room.room) ?? 0}
          cracked={cracked.has(room.room)}
          current={here === room.room}
          unitsPerPx={unitsPerPx}
          nameSizePx={PX.name}
          countSizePx={showCounts ? PX.count : null}
          labels={labels}
          onClick={onRoomClick}
        />
      ))}
      {rooms.map((room) => {
        const front = roomFront(room);
        return <line key={`${room.room}-door`} x1={room.door[0]} y1={room.door[2]} x2={front[0]} y2={front[2]} className={here === room.room || (here === null && player) ? "stroke-sky-100" : "stroke-white"} strokeWidth={DOOR_WIDTH} strokeLinecap="butt" />;
      })}
      {player && (
        <g transform={`translate(${player[0]} ${player[1]})`} aria-hidden>
          {yaw !== null && <line x1={0} y1={0} x2={-Math.sin(yaw) * PX.heading * unitsPerPx} y2={-Math.cos(yaw) * PX.heading * unitsPerPx} className="stroke-sky-700" strokeWidth={1.5 * unitsPerPx} strokeLinecap="round" />}
          <circle r={PX.dot * unitsPerPx} className="fill-sky-600 stroke-white" strokeWidth={PX.dotStroke * unitsPerPx} />
        </g>
      )}
    </svg>
  );
}
