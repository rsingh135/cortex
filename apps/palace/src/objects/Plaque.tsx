"use client";
/**
 * Small engraved plaque (a plaster tile with one line of text). Faces +z like paintings.
 */
import { Text } from "@react-three/drei";
import type { Vec3 } from "@/lib/types";
import { INK, PLAQUE_HEIGHT, PLAQUE_WIDTH, PLASTER_SHADOW } from "./palette";

export interface PlaqueProps {
  text: string;
  position?: Vec3;
  width?: number;
  height?: number;
  color?: string;
  /** Optional font URL for drei `<Text>`; the default fetches troika's bundled font. */
  font?: string;
}

const PLAQUE_DEPTH = 0.012;

export function Plaque({ text, position = [0, 0, 0], width = PLAQUE_WIDTH, height = PLAQUE_HEIGHT, color = INK, font }: PlaqueProps) {
  return (
    <group position={position}>
      <mesh>
        <boxGeometry args={[width, height, PLAQUE_DEPTH]} />
        <meshStandardMaterial color={PLASTER_SHADOW} roughness={0.8} />
      </mesh>
      <Text position={[0, 0, PLAQUE_DEPTH / 2 + 0.001]} fontSize={height * 0.5} maxWidth={width * 0.9} color={color} anchorX="center" anchorY="middle" font={font} characters={text}>
        {text}
      </Text>
    </group>
  );
}
