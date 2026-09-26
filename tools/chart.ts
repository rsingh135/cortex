/**
 * The closing chart: bytes stored (top) and weighted accuracy (bottom) over simulated days,
 * one line per memory strategy. Renders a self-contained SVG for slides and the palace.
 *
 *   pnpm chart                       # simulator bytes, accuracy panel marked pending
 *   pnpm chart --accuracy eval.json  # eval output {rows:[{condition, day, accuracy_weighted}]}
 *   pnpm chart --out chart.svg
 *
 * Series colors are the validated three-slot categorical palette (blue, orange, aqua);
 * assigned by entity, never by rank. Direct labels at line ends, legend present, one axis per panel.
 */
import { readFileSync, writeFileSync } from "node:fs";
import { DEFAULT_INPUT, simulate, type DayRow } from "./simulate";
import type { Condition } from "@cortex/schema";

export interface AccuracyRow {
  condition: Condition;
  day: number;
  accuracy_weighted: number;
}

const SERIES: Array<{ condition: Condition; label: string; color: string }> = [
  { condition: "keep_all", label: "Keep everything", color: "#2a78d6" },
  { condition: "blur_by_age", label: "Blur by age", color: "#eb6834" },
  { condition: "cortex", label: "Cortex", color: "#1baf7a" },
];

const INK = { primary: "#0b0b0b", secondary: "#52514e", muted: "#898781", grid: "#e1e0d9", axis: "#c3c2b7", surface: "#fcfcfb" };

const W = 960;
const PANEL_H = 260;
const PAD = { left: 64, right: 150, top: 76, gap: 48, bottom: 72 };
const H = PAD.top + PANEL_H * 2 + PAD.gap + PAD.bottom;

interface Scale {
  x(day: number): number;
  y(v: number): number;
}

function scale(top: number, xDays: number, yMax: number): Scale {
  const plotW = W - PAD.left - PAD.right;
  return {
    x: (day) => PAD.left + ((day - 1) / (xDays - 1)) * plotW,
    y: (v) => top + PANEL_H - (v / yMax) * PANEL_H,
  };
}

function path(points: Array<[number, number]>): string {
  return points.map(([x, y], i) => `${i ? "L" : "M"}${x.toFixed(1)} ${y.toFixed(1)}`).join(" ");
}

function niceMax(v: number): number {
  const pow = Math.pow(10, Math.floor(Math.log10(v)));
  const n = v / pow;
  const step = n <= 1 ? 1 : n <= 2 ? 2 : n <= 5 ? 5 : 10;
  return step * pow;
}

function panel(opts: {
  top: number;
  title: string;
  unit: string;
  yMax: number;
  yTicks: number[];
  yFormat: (v: number) => string;
  lines: Array<{ color: string; label: string; points: Array<[number, number]> }>;
  days: number;
  note?: string;
}): string {
  const s = scale(opts.top, opts.days, opts.yMax);
  const parts: string[] = [];
  parts.push(`<text x="${PAD.left}" y="${opts.top - 14}" font-size="15" font-weight="600" fill="${INK.primary}">${opts.title}</text>`);
  for (const t of opts.yTicks) {
    const y = s.y(t);
    parts.push(`<line x1="${PAD.left}" x2="${W - PAD.right}" y1="${y.toFixed(1)}" y2="${y.toFixed(1)}" stroke="${INK.grid}" stroke-width="1"/>`);
    parts.push(`<text x="${PAD.left - 10}" y="${(y + 4).toFixed(1)}" font-size="12" text-anchor="end" fill="${INK.muted}">${opts.yFormat(t)}</text>`);
  }
  parts.push(`<line x1="${PAD.left}" x2="${W - PAD.right}" y1="${s.y(0)}" y2="${s.y(0)}" stroke="${INK.axis}" stroke-width="1"/>`);
  parts.push(`<text x="${PAD.left - 10}" y="${opts.top - 14}" font-size="11" text-anchor="end" fill="${INK.muted}">${opts.unit}</text>`);
  if (opts.note) {
    parts.push(`<text x="${(PAD.left + (W - PAD.right)) / 2}" y="${opts.top + PANEL_H / 2}" font-size="14" text-anchor="middle" fill="${INK.secondary}">${opts.note}</text>`);
  }
  for (const line of opts.lines) {
    if (line.points.length === 0) continue;
    const pts = line.points.map(([d, v]) => [s.x(d), s.y(v)] as [number, number]);
    parts.push(`<path d="${path(pts)}" fill="none" stroke="${line.color}" stroke-width="2" stroke-linejoin="round" stroke-linecap="round"/>`);
    const last = pts[pts.length - 1]!;
    parts.push(`<circle cx="${last[0].toFixed(1)}" cy="${last[1].toFixed(1)}" r="4" fill="${line.color}" stroke="${INK.surface}" stroke-width="2"/>`);
    parts.push(`<text x="${(last[0] + 10).toFixed(1)}" y="${(last[1] + 4).toFixed(1)}" font-size="12" fill="${INK.secondary}">${line.label}</text>`);
  }
  return parts.join("\n");
}

export function renderChart(rows: DayRow[], accuracy: AccuracyRow[] | null, checkpoints = [5, 10, 15, 20, 25, 30]): string {
  const days = rows.length;
  const bytesMax = niceMax(Math.max(...rows.map((r) => Math.max(r.bytes.cortex, r.bytes.keep_all, r.bytes.blur_by_age))) / 1e6);
  const bytesTicks = [0, bytesMax / 4, bytesMax / 2, (bytesMax * 3) / 4, bytesMax];
  const top1 = PAD.top;
  const top2 = PAD.top + PANEL_H + PAD.gap;

  const bytesLines = SERIES.map((se) => ({
    color: se.color,
    label: se.label,
    points: rows.map((r) => [r.day, r.bytes[se.condition] / 1e6] as [number, number]),
  }));
  const accLines = SERIES.map((se) => ({
    color: se.color,
    label: se.label,
    points: (accuracy ?? [])
      .filter((a) => a.condition === se.condition)
      .sort((a, b) => a.day - b.day)
      .map((a) => [a.day, a.accuracy_weighted * 100] as [number, number]),
  }));

  const xLabels = Array.from({ length: days }, (_, i) => i + 1)
    .filter((d) => d === 1 || d % 5 === 0)
    .map((d) => `<text x="${scale(0, days, 1).x(d).toFixed(1)}" y="${H - PAD.bottom + 20}" font-size="12" text-anchor="middle" fill="${INK.muted}">${d}</text>`)
    .join("\n");
  const checkpointMarks = checkpoints
    .map((d) => `<line x1="${scale(0, days, 1).x(d).toFixed(1)}" x2="${scale(0, days, 1).x(d).toFixed(1)}" y1="${top2}" y2="${top2 + PANEL_H}" stroke="${INK.grid}" stroke-width="1" stroke-dasharray="2 4"/>`)
    .join("\n");

  const legend = SERIES.map((se, i) => {
    const x = PAD.left + i * 170;
    return `<rect x="${x}" y="${H - 16}" width="12" height="12" rx="2" fill="${se.color}"/><text x="${x + 18}" y="${H - 6}" font-size="12" fill="${INK.secondary}">${se.label}</text>`;
  }).join("\n");

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" font-family="system-ui, -apple-system, Segoe UI, sans-serif">
<rect width="${W}" height="${H}" fill="${INK.surface}"/>
<text x="${PAD.left}" y="28" font-size="13" fill="${INK.secondary}">Cortex gets keep-everything's accuracy at a fraction of the storage. Simulated days 1–${days}.</text>
${panel({ top: top1, title: "Bytes stored", unit: "MB", yMax: bytesMax, yTicks: bytesTicks, yFormat: (v) => v.toFixed(0), lines: bytesLines, days })}
${checkpointMarks}
${panel({
  top: top2,
  title: "Weighted answer accuracy",
  unit: "%",
  yMax: 100,
  yTicks: [0, 25, 50, 75, 100],
  yFormat: (v) => v.toFixed(0),
  lines: accLines,
  days,
  ...(accuracy ? {} : { note: "Evaluation pending: accuracy is measured on days 5, 10, 15, 20, 25 and 30" }),
})}
<text x="${(PAD.left + (W - PAD.right)) / 2}" y="${H - PAD.bottom + 40}" font-size="12" text-anchor="middle" fill="${INK.muted}">simulated day</text>
${xLabels}
${legend}
</svg>
`;
}

function main(): void {
  const argv = process.argv.slice(2);
  const arg = (flag: string): string | undefined => {
    const i = argv.indexOf(flag);
    return i >= 0 ? argv[i + 1] : undefined;
  };
  const accPath = arg("--accuracy");
  const out = arg("--out") ?? "chart.svg";
  const accuracy = accPath ? (JSON.parse(readFileSync(accPath, "utf8")) as { rows: AccuracyRow[] }).rows : null;
  const svg = renderChart(simulate(DEFAULT_INPUT), accuracy);
  writeFileSync(out, svg);
  console.log(`wrote ${out} (${(svg.length / 1024).toFixed(0)} KB)${accuracy ? "" : ", accuracy panel pending"}`);
}

if (process.argv[1] && /chart\.ts$/.test(process.argv[1])) main();
