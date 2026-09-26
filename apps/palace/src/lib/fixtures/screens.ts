"use client";
/**
 * Placeholder screenshots. Draws a clearly fake app screen for a capture on a canvas at the
 * resolution of its ceiling level (L0 1280x800, then quartered per rung) and returns a data URL.
 * Real captures later supply a WebP URL through the same `textureUrl` field.
 */
import type { App, Level } from "@cortex/schema";
import { fnv1a } from "../hash";
import type { PalaceCapture } from "../types";
import { createPrng, type Prng } from "./prng";

export const L0_SIZE: [number, number] = [1280, 800];

export function levelResolution(level: Level): [number, number] {
  const divisor: Record<Level, number> = { L0: 1, L1: 2, L2: 4, L3: 8 };
  return [L0_SIZE[0] / divisor[level], L0_SIZE[1] / divisor[level]];
}

interface Palette {
  bg: string;
  panel: string;
  ink: string;
  muted: string;
  accent: string;
  line: string;
}

const PALETTES: Record<App, Palette> = {
  mockloft: { bg: "#f6f3ee", panel: "#ffffff", ink: "#2b2b2b", muted: "#8a8378", accent: "#c8553d", line: "#e6e0d6" },
  inbox: { bg: "#f4f6f8", panel: "#ffffff", ink: "#1f2933", muted: "#7b8794", accent: "#3b6ea5", line: "#e1e6ea" },
  calendar: { bg: "#fbfbf9", panel: "#ffffff", ink: "#2a2a2a", muted: "#9a9a92", accent: "#5a8f5a", line: "#e5e5df" },
  landlord_chat: { bg: "#f2f4f0", panel: "#ffffff", ink: "#242a24", muted: "#7f877f", accent: "#3f7f6f", line: "#dfe4de" },
};

/** Data URL of a fake screen for this capture, or null when there is no DOM or the capture is forgotten. */
export function placeholderScreenshot(capture: Pick<PalaceCapture, "id" | "app" | "title" | "ceiling">, seed: number): string | null {
  if (typeof document === "undefined") return null;
  if (capture.ceiling === null) return null;
  const [w, h] = levelResolution(capture.ceiling);
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;
  const prng = createPrng((seed ^ fnv1a(capture.id)) >>> 0);
  const scale = w / L0_SIZE[0];
  ctx.save();
  ctx.scale(scale, scale);
  drawScreen(ctx, capture.app, capture.title, prng);
  ctx.restore();
  try {
    return canvas.toDataURL("image/webp", 0.8);
  } catch {
    return canvas.toDataURL("image/png");
  }
}

/** Draws in L0 pixel space (1280x800); the caller scales for smaller levels. */
export function drawScreen(ctx: CanvasRenderingContext2D, app: App, title: string, prng: Prng): void {
  const p = PALETTES[app];
  const [W, H] = L0_SIZE;
  ctx.fillStyle = p.bg;
  ctx.fillRect(0, 0, W, H);
  drawChrome(ctx, p, title);
  switch (app) {
    case "mockloft":
      drawListing(ctx, p, prng);
      break;
    case "inbox":
      drawInbox(ctx, p, prng);
      break;
    case "calendar":
      drawCalendar(ctx, p, prng);
      break;
    case "landlord_chat":
      drawChat(ctx, p, prng);
      break;
  }
}

function drawChrome(ctx: CanvasRenderingContext2D, p: Palette, title: string): void {
  ctx.fillStyle = p.panel;
  ctx.fillRect(0, 0, 1280, 56);
  ctx.fillStyle = p.line;
  ctx.fillRect(0, 56, 1280, 2);
  ctx.fillStyle = p.accent;
  ctx.beginPath();
  ctx.arc(36, 28, 10, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = p.ink;
  ctx.font = "600 20px system-ui, sans-serif";
  ctx.textBaseline = "middle";
  ctx.fillText(title.slice(0, 60), 64, 28);
}

function drawListing(ctx: CanvasRenderingContext2D, p: Palette, prng: Prng): void {
  ctx.fillStyle = p.panel;
  roundRect(ctx, 80, 96, 1120, 640, 16);
  ctx.fill();
  const hue = prng.int(20, 200);
  ctx.fillStyle = `hsl(${hue} 30% 78%)`;
  roundRect(ctx, 112, 128, 620, 400, 12);
  ctx.fill();
  ctx.fillStyle = `hsl(${hue} 30% 62%)`;
  for (let i = 0; i < 3; i++) {
    roundRect(ctx, 112 + i * 210, 548, 200, 100, 8);
    ctx.fill();
  }
  ctx.fillStyle = p.ink;
  ctx.font = "700 40px system-ui, sans-serif";
  ctx.textBaseline = "top";
  ctx.fillText(`$${prng.int(21, 31) * 100} / mo`, 772, 136);
  ctx.font = "400 24px system-ui, sans-serif";
  ctx.fillStyle = p.muted;
  ctx.fillText("1 bed · 1 bath · 640 sq ft", 772, 196);
  const chips = [prng.pick(["L train", "G train", "M train"]), prng.pick(["Floor 2", "Floor 5", "Floor 3"]), prng.pick(["Laundry in unit", "No laundry", "Laundry in bldg"]), prng.pick(["Elevator", "Walk-up"]), prng.pick(["Pets ok", "No pets"])];
  chips.forEach((chip, i) => {
    const y = 256 + i * 56;
    ctx.fillStyle = p.bg;
    roundRect(ctx, 772, y, 320, 40, 20);
    ctx.fill();
    ctx.fillStyle = p.ink;
    ctx.font = "500 20px system-ui, sans-serif";
    ctx.fillText(chip, 796, y + 9);
  });
  ctx.fillStyle = p.accent;
  roundRect(ctx, 772, 560, 320, 56, 12);
  ctx.fill();
  ctx.fillStyle = "#ffffff";
  ctx.font = "600 22px system-ui, sans-serif";
  ctx.fillText("Message landlord", 826, 576);
}

function drawInbox(ctx: CanvasRenderingContext2D, p: Palette, prng: Prng): void {
  ctx.fillStyle = p.panel;
  ctx.fillRect(0, 58, 280, 742);
  ctx.fillStyle = p.line;
  ctx.fillRect(280, 58, 2, 742);
  ctx.font = "500 20px system-ui, sans-serif";
  ctx.textBaseline = "middle";
  ["Inbox", "Starred", "Sent", "Drafts", "Leases", "Work"].forEach((label, i) => {
    ctx.fillStyle = i === 0 ? p.accent : p.muted;
    ctx.fillText(label, 32, 100 + i * 44);
  });
  for (let i = 0; i < 11; i++) {
    const y = 72 + i * 66;
    ctx.fillStyle = i % 2 === 0 ? p.panel : p.bg;
    ctx.fillRect(282, y, 998, 64);
    ctx.fillStyle = p.line;
    ctx.fillRect(282, y + 64, 998, 1);
    ctx.fillStyle = prng.chance(0.3) ? p.accent : p.line;
    ctx.beginPath();
    ctx.arc(310, y + 32, 6, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = p.ink;
    roundRect(ctx, 340, y + 22, prng.int(120, 200), 18, 4);
    ctx.fill();
    ctx.fillStyle = p.muted;
    roundRect(ctx, 580, y + 24, prng.int(300, 600), 14, 4);
    ctx.fill();
  }
}

function drawCalendar(ctx: CanvasRenderingContext2D, p: Palette, prng: Prng): void {
  const left = 60;
  const top = 96;
  const colW = (1280 - left - 40) / 7;
  const rowH = (800 - top - 24) / 12;
  ctx.fillStyle = p.panel;
  ctx.fillRect(left, top, colW * 7, rowH * 12);
  ctx.strokeStyle = p.line;
  ctx.lineWidth = 1;
  for (let c = 0; c <= 7; c++) {
    ctx.beginPath();
    ctx.moveTo(left + c * colW, top);
    ctx.lineTo(left + c * colW, top + rowH * 12);
    ctx.stroke();
  }
  for (let r = 0; r <= 12; r++) {
    ctx.beginPath();
    ctx.moveTo(left, top + r * rowH);
    ctx.lineTo(left + colW * 7, top + r * rowH);
    ctx.stroke();
  }
  const events = prng.int(5, 9);
  for (let i = 0; i < events; i++) {
    const c = prng.int(0, 6);
    const r = prng.int(0, 9);
    const span = prng.int(1, 3);
    const hue = prng.pick([120, 200, 30, 280]);
    ctx.fillStyle = `hsl(${hue} 40% 82%)`;
    roundRect(ctx, left + c * colW + 6, top + r * rowH + 4, colW - 12, rowH * span - 8, 6);
    ctx.fill();
    ctx.fillStyle = `hsl(${hue} 40% 35%)`;
    roundRect(ctx, left + c * colW + 16, top + r * rowH + 14, colW * 0.6, 10, 3);
    ctx.fill();
  }
}

function drawChat(ctx: CanvasRenderingContext2D, p: Palette, prng: Prng): void {
  ctx.fillStyle = p.panel;
  roundRect(ctx, 240, 90, 800, 690, 16);
  ctx.fill();
  let y = 120;
  const n = prng.int(5, 8);
  for (let i = 0; i < n; i++) {
    const mine = i % 2 === 1;
    const w = prng.int(240, 480);
    const h = prng.int(44, 96);
    ctx.fillStyle = mine ? p.accent : p.bg;
    roundRect(ctx, mine ? 1000 - w : 272, y, w, h, 18);
    ctx.fill();
    ctx.fillStyle = mine ? "rgba(255,255,255,0.7)" : p.muted;
    for (let line = 0; line < Math.floor(h / 26); line++) {
      roundRect(ctx, (mine ? 1000 - w : 272) + 18, y + 14 + line * 24, w - 36 - prng.int(0, 80), 10, 3);
      ctx.fill();
    }
    y += h + 16;
  }
  ctx.fillStyle = p.bg;
  roundRect(ctx, 272, 710, 728, 48, 24);
  ctx.fill();
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number): void {
  const radius = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.arcTo(x + w, y, x + w, y + h, radius);
  ctx.arcTo(x + w, y + h, x, y + h, radius);
  ctx.arcTo(x, y + h, x, y, radius);
  ctx.arcTo(x, y, x + w, y, radius);
  ctx.closePath();
}
