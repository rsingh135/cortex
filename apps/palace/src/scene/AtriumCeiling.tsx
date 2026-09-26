"use client";
/**
 * Plaster ceiling ring over the atrium with a round skylight opening and a short curb around it.
 * The ring receives shadows but casts none: the atrium is meant to read as a bright, sky-lit hall,
 * and a ring-shaped shadow would leave its walls in permanent gloom.
 */
import { useMemo } from "react";
import { DoubleSide, Path, Shape, ShapeGeometry } from "three";
import { useLayout } from "@/lib/store";
import { ATRIUM_HEIGHT, SKYLIGHT_CURB_HEIGHT, SKYLIGHT_RADIUS, WALL_THICKNESS, atriumPolygon } from "./geometry";
import { PALETTE } from "./materials";

export function AtriumCeiling() {
  const layout = useLayout();
  const geometry = useMemo(() => {
    const shape = new Shape();
    const points = atriumPolygon(layout.atriumRadius + WALL_THICKNESS / 2);
    points.forEach(([x, z], i) => (i === 0 ? shape.moveTo(x, -z) : shape.lineTo(x, -z)));
    shape.closePath();
    const hole = new Path();
    hole.absarc(0, 0, SKYLIGHT_RADIUS, 0, Math.PI * 2, true);
    shape.holes.push(hole);
    return new ShapeGeometry(shape, 48);
  }, [layout.atriumRadius]);

  return (
    <group position-y={ATRIUM_HEIGHT}>
      <mesh geometry={geometry} rotation-x={-Math.PI / 2} receiveShadow>
        <meshStandardMaterial color={PALETTE.plaster} roughness={0.95} side={DoubleSide} />
      </mesh>
      <mesh position-y={SKYLIGHT_CURB_HEIGHT / 2}>
        <cylinderGeometry args={[SKYLIGHT_RADIUS + WALL_THICKNESS, SKYLIGHT_RADIUS + WALL_THICKNESS, SKYLIGHT_CURB_HEIGHT, 96, 1, true]} />
        <meshStandardMaterial color={PALETTE.plaster} roughness={0.95} side={DoubleSide} />
      </mesh>
    </group>
  );
}
