"use client";
/**
 * Shared materials for the architecture: white plaster, pale oak planks, warm stone, dark wood door
 * reveals. Created lazily
 * (the plank texture needs a document) and shared by every wall and floor so the scene stays at a
 * handful of materials.
 */
import { CanvasTexture, Color, MeshStandardMaterial, RepeatWrapping, SRGBColorSpace } from "three";

export const PALETTE = {
  plaster: "#f4f0e8",
  plasterShade: "#e9e4da",
  oak: "#cfb58d",
  oakDark: "#b89b74",
  stone: "#e7e2d9",
  stoneRing: "#d8d1c6",
  skyZenith: "#a9c4e2",
  skyHorizon: "#eef2f6",
  ground: "#dcd7cf",
  /** Hemisphere fill: near-white warm sky over pale ground, so shaded plaster stays white rather than grey. */
  fillSky: "#eef0f2",
  fillGround: "#e8e2d8",
  lettering: "#5a544c",
  doorGlow: "#f2c27a",
  doorWood: "#b89a72",
} as const;

export interface ArchitectureMaterials {
  plaster: MeshStandardMaterial;
  oak: MeshStandardMaterial;
  stone: MeshStandardMaterial;
  stoneRing: MeshStandardMaterial;
  /** Doorway reveals. */
  doorWood: MeshStandardMaterial;
}

let cached: ArchitectureMaterials | null = null;

export function getMaterials(): ArchitectureMaterials {
  if (cached) return cached;
  const plaster = new MeshStandardMaterial({ color: new Color(PALETTE.plaster), roughness: 0.92, metalness: 0 });
  const oak = new MeshStandardMaterial({ color: new Color("#ffffff"), roughness: 0.72, metalness: 0 });
  const planks = plankTexture();
  if (planks) oak.map = planks;
  else oak.color.set(PALETTE.oak);
  const stone = new MeshStandardMaterial({ color: new Color(PALETTE.stone), roughness: 0.85, metalness: 0 });
  const stoneRing = new MeshStandardMaterial({ color: new Color(PALETTE.stoneRing), roughness: 0.85, metalness: 0 });
  const doorWood = new MeshStandardMaterial({ color: new Color(PALETTE.doorWood), roughness: 0.75, metalness: 0 });
  cached = { plaster, oak, stone, stoneRing, doorWood };
  return cached;
}

/** Procedural pale-oak planks, 1 texture unit = 2 m x 2 m of floor. */
function plankTexture(): CanvasTexture | null {
  if (typeof document === "undefined") return null;
  const size = 512;
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;
  const plankWidth = size / 8;
  const base = new Color(PALETTE.oak);
  const dark = new Color(PALETTE.oakDark);
  let seed = 7;
  const rand = () => {
    seed = (seed * 1103515245 + 12345) & 0x7fffffff;
    return seed / 0x7fffffff;
  };
  for (let i = 0; i < 8; i++) {
    const tone = base.clone().lerp(dark, rand() * 0.55);
    ctx.fillStyle = `#${tone.getHexString()}`;
    ctx.fillRect(i * plankWidth, 0, plankWidth, size);
    // Faint grain lines.
    ctx.strokeStyle = `rgba(90, 65, 35, ${0.05 + rand() * 0.05})`;
    ctx.lineWidth = 1;
    for (let g = 0; g < 6; g++) {
      const x = i * plankWidth + rand() * plankWidth;
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.bezierCurveTo(x + (rand() - 0.5) * 10, size / 3, x + (rand() - 0.5) * 10, (2 * size) / 3, x + (rand() - 0.5) * 6, size);
      ctx.stroke();
    }
    // Plank ends, staggered per column.
    const offset = rand() * size;
    ctx.fillStyle = "rgba(70, 50, 30, 0.18)";
    ctx.fillRect(i * plankWidth, offset, plankWidth, 2);
    ctx.fillRect(i * plankWidth, (offset + size / 2) % size, plankWidth, 2);
    ctx.fillRect(i * plankWidth, 0, 1, size);
  }
  const texture = new CanvasTexture(canvas);
  texture.wrapS = RepeatWrapping;
  texture.wrapT = RepeatWrapping;
  texture.colorSpace = SRGBColorSpace;
  texture.anisotropy = 8;
  return texture;
}
