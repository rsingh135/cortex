"use client";
/** Warm stone floor of the atrium with a darker ring echoing the skylight, plus the doorway thresholds. */
import { useMemo } from "react";
import { Shape, ShapeGeometry } from "three";
import { DOOR_WIDTH, roomRotationY } from "@/lib/layout";
import { useLayout } from "@/lib/store";
import { SKYLIGHT_RADIUS, WALL_THICKNESS, atriumPolygon, doorways } from "./geometry";
import { getMaterials } from "./materials";

export function AtriumFloor() {
  const layout = useLayout();
  const { stone, stoneRing, oak } = getMaterials();
  const geometry = useMemo(() => {
    const shape = new Shape();
    // Grow the slab a little so it runs under the walls.
    const points = atriumPolygon(layout.atriumRadius + WALL_THICKNESS);
    points.forEach(([x, z], i) => (i === 0 ? shape.moveTo(x, -z) : shape.lineTo(x, -z)));
    shape.closePath();
    return new ShapeGeometry(shape);
  }, [layout.atriumRadius]);
  const ways = useMemo(() => doorways(layout), [layout]);

  return (
    <group>
      <mesh geometry={geometry} material={stone} rotation-x={-Math.PI / 2} receiveShadow />
      <mesh material={stoneRing} rotation-x={-Math.PI / 2} position-y={0.004} receiveShadow>
        <ringGeometry args={[SKYLIGHT_RADIUS - 0.35, SKYLIGHT_RADIUS, 96]} />
      </mesh>
      {ways.map((d) => (
        <group key={d.room} position={[(d.outer[0] + d.inner[0]) / 2, 0.002, (d.outer[2] + d.inner[2]) / 2]} rotation-y={roomRotationY(d.room)}>
          <mesh material={oak} rotation-x={-Math.PI / 2} receiveShadow>
            <planeGeometry args={[DOOR_WIDTH + WALL_THICKNESS, d.length + WALL_THICKNESS]} />
          </mesh>
        </group>
      ))}
    </group>
  );
}
