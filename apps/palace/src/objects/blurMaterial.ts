"use client";
/**
 * Gaussian blur ShaderMaterial for paintings. Single pass, 7x7 taps spread over `uRadius` (UV
 * units); radius 0 samples the texel directly. Without a texture it paints a flat plaster tint so
 * a painting whose screenshot is still loading reads as a blank canvas, not a hole.
 */
import * as THREE from "three";
import { FORGOTTEN_CANVAS } from "./palette";

export interface BlurUniforms {
  uMap: { value: THREE.Texture | null };
  uHasMap: { value: number };
  uRadius: { value: number };
  uOpacity: { value: number };
  uTint: { value: THREE.Color };
  [uniform: string]: THREE.IUniform;
}

export type BlurMaterial = THREE.ShaderMaterial & { uniforms: BlurUniforms };

export const BLUR_VERTEX_SHADER = /* glsl */ `
varying vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`;

export const BLUR_FRAGMENT_SHADER = /* glsl */ `
uniform sampler2D uMap;
uniform float uHasMap;
uniform float uRadius;
uniform float uOpacity;
uniform vec3 uTint;
varying vec2 vUv;

const float SIGMA = 1.5;

void main() {
  if (uHasMap < 0.5) {
    gl_FragColor = vec4(uTint, uOpacity);
    #include <colorspace_fragment>
    return;
  }
  if (uRadius < 0.0005) {
    vec4 texel = texture2D(uMap, vUv);
    gl_FragColor = vec4(texel.rgb, texel.a * uOpacity);
    #include <colorspace_fragment>
    return;
  }
  vec4 sum = vec4(0.0);
  float weightSum = 0.0;
  for (int i = -3; i <= 3; i++) {
    for (int j = -3; j <= 3; j++) {
      vec2 offset = vec2(float(i), float(j)) * (uRadius / 3.0);
      float w = exp(-float(i * i + j * j) / (2.0 * SIGMA * SIGMA));
      sum += texture2D(uMap, clamp(vUv + offset, 0.0, 1.0)) * w;
      weightSum += w;
    }
  }
  vec4 blurred = sum / weightSum;
  gl_FragColor = vec4(blurred.rgb, uOpacity);
  #include <colorspace_fragment>
}
`;

/** Fresh uniform set for one painting (uniform objects are per material, never shared). */
export function createBlurUniforms(): BlurUniforms {
  return {
    uMap: { value: null },
    uHasMap: { value: 0 },
    uRadius: { value: 0 },
    uOpacity: { value: 1 },
    uTint: { value: new THREE.Color(FORGOTTEN_CANVAS) },
  };
}

/** Imperative construction, for code outside React; `Painting` builds the same material in JSX. */
export function createBlurMaterial(): BlurMaterial {
  const material = new THREE.ShaderMaterial({
    uniforms: createBlurUniforms(),
    vertexShader: BLUR_VERTEX_SHADER,
    fragmentShader: BLUR_FRAGMENT_SHADER,
    transparent: false,
    toneMapped: false,
  });
  return material as BlurMaterial;
}
