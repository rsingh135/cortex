"use client";
/**
 * One room on the floor plan: clickable polygon, its label and belief count, and a red "!" badge in
 * a corner when one of its procedures is cracked. "You are here" is the strong blue fill; a cracked
 * room keeps a plain fill so the two never read alike.
 */
import type { KeyboardEvent } from "react";
import type { PalaceRoom, RoomLayout } from "@/lib/layout";
import { formatCount } from "@/lib/format";

export interface MinimapRoomProps {
  room: RoomLayout;
  corners: ReadonlyArray<[number, number]>;
  count: number;
  cracked: boolean;
  current: boolean;
  /** World meters per rendered pixel. */
  unitsPerPx: number;
  nameSizePx: number;
  /** Null hides the count (small maps). */
  countSizePx: number | null;
  labels: boolean;
  onClick?: (room: PalaceRoom) => void;
}

const BADGE_RADIUS_PX = 6;
const BADGE_FONT_PX = 9;
/** A footprint narrower than this on screen gets its name only; the count would spill over the edge. */
const COUNT_MIN_ROOM_PX = 40;

export function MinimapRoom({ room, corners, count, cracked, current, unitsPerPx, nameSizePx, countSizePx, labels, onClick }: MinimapRoomProps) {
  const points = corners.map(([x, z]) => `${x.toFixed(2)},${z.toFixed(2)}`).join(" ");
  const interactive = onClick !== undefined;
  const description = `${room.room}: ${formatCount(count, "belief")}${cracked ? ", cracked procedure" : ""}${current ? ", you are here" : ""}`;
  const fill = current ? "fill-sky-200" : "fill-white";
  const stroke = current ? "stroke-sky-700" : "stroke-zinc-500";
  const activate = () => onClick?.(room.room);
  const onKeyDown = (e: KeyboardEvent<SVGGElement>) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      activate();
    }
  };
  const name = nameSizePx * unitsPerPx;
  const countSize = countSizePx === null || room.size[0] / unitsPerPx < COUNT_MIN_ROOM_PX ? null : countSizePx * unitsPerPx;
  // Screen top-right of the footprint: the corner with the largest x - z.
  const badgeCorner = corners.reduce((best, c) => (c[0] - c[1] > best[0] - best[1] ? c : best), corners[0]);
  const badgeR = BADGE_RADIUS_PX * unitsPerPx;
  const cx = room.center[0];
  const cz = room.center[2];
  const nameY = countSize === null ? cz + 0.35 * name : cz - 0.15 * name;

  return (
    <g
      role={interactive ? "button" : undefined}
      tabIndex={interactive ? 0 : undefined}
      aria-label={interactive ? `${description}. Fly there` : description}
      onClick={interactive ? activate : undefined}
      onKeyDown={interactive ? onKeyDown : undefined}
      className={`group outline-none ${interactive ? "cursor-pointer" : ""}`}
    >
      <polygon points={points} className={`${fill} ${stroke} transition-colors group-hover:fill-sky-100 group-focus-visible:fill-sky-100`} strokeWidth={(current ? 1.6 : 1.2) * unitsPerPx} strokeLinejoin="round" />
      {labels && (
        <>
          <text x={cx} y={nameY} textAnchor="middle" fontSize={name} className={`pointer-events-none font-semibold ${current ? "fill-sky-950" : "fill-zinc-800"}`}>
            {room.room}
          </text>
          {countSize !== null && (
            <text x={cx} y={cz + 1.05 * countSize + 0.35 * name} textAnchor="middle" fontSize={countSize} className={`pointer-events-none tabular-nums ${current ? "fill-sky-800" : "fill-zinc-500"}`}>
              {count}
            </text>
          )}
        </>
      )}
      {cracked && (
        <g transform={`translate(${badgeCorner[0]} ${badgeCorner[1]})`} className="pointer-events-none" aria-hidden>
          <circle r={badgeR} className="fill-red-600 stroke-white" strokeWidth={1.2 * unitsPerPx} />
          <text y={0.36 * BADGE_FONT_PX * unitsPerPx} textAnchor="middle" fontSize={BADGE_FONT_PX * unitsPerPx} className="fill-white font-bold">
            !
          </text>
        </g>
      )}
    </g>
  );
}
