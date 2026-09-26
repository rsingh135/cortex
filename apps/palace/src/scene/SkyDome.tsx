"use client";
/** A large inverted sphere with a vertical gradient: pale blue zenith, white horizon, warm ground. */
import { GradientTexture } from "@react-three/drei";
import { BackSide } from "three";
import { PALETTE } from "./materials";

const SKY_RADIUS = 300;

export function SkyDome() {
  return (
    <mesh scale={[1, 1, 1]} frustumCulled={false}>
      <sphereGeometry args={[SKY_RADIUS, 32, 16]} />
      <meshBasicMaterial side={BackSide} fog={false} toneMapped={false}>
        <GradientTexture stops={[0, 0.48, 0.52, 1]} colors={[PALETTE.skyZenith, PALETTE.skyHorizon, PALETTE.skyHorizon, PALETTE.ground]} size={256} />
      </meshBasicMaterial>
    </mesh>
  );
}
