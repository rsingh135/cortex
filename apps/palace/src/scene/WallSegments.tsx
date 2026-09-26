"use client";
/** Renders wall segments as boxes: plaster walls, dark-wood doorway reveals. One box per segment; corners are closed by growing each box half a thickness. */
import { WALL_THICKNESS, segmentTransform, type WallSegment } from "./geometry";
import { getMaterials } from "./materials";

export interface WallSegmentsProps {
  walls: readonly WallSegment[];
}

export function WallSegments({ walls }: WallSegmentsProps) {
  const { plaster, doorWood } = getMaterials();
  return (
    <group>
      {walls.map((w, i) => {
        const t = segmentTransform(w);
        return (
          <mesh key={`${w.owner}-${i}`} position={t.center} rotation-y={t.rotationY} material={w.finish === "wood" ? doorWood : plaster} castShadow receiveShadow>
            <boxGeometry args={[t.length, t.height, WALL_THICKNESS]} />
          </mesh>
        );
      })}
    </group>
  );
}
