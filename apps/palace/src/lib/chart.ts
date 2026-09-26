/**
 * The closing chart (beat 5): bytes stored on top, weighted answer accuracy below, one line per
 * memory strategy. A port of tools/chart.ts so the palace and the slide render the same picture.
 * Series colours are the validated categorical palette, assigned by entity, never by rank.
 */
import { DEFAULT_PARAMS, aliveLevelsOn, type Condition, type Level } from "@cortex/schema";

export interface DayRow {
  day: number;
  bytes: Record<Condition, number>;
}

export interface AccuracyRow {
  condition: Condition;
  day: number;
  accuracy_weighted: number;
}

export const CHECKPOINT_DAYS = [5, 10, 15, 20, 25, 30] as const;

const SERIES: Array<{ condition: Condition; label: string; color: string }> = [
  { condition: "keep_all", label: "Keep everything", color: "#2a78d6" },
  { condition: "blur_by_age", label: "Blur by age", color: "#eb6834" },
  { condition: "cortex", label: "Cortex", color: "#1baf7a" },
];

export const CHART_SERIES = SERIES;

const INK = { primary: "#0b0b0b", secondary: "#52514e", muted: "#898781", grid: "#e1e0d9", axis: "#c3c2b7", surface: "#fcfcfb" };

const W = 960;
const PANEL_H = 260;
const PAD = { left: 64, right: 150, top: 76, gap: 48, bottom: 72 };
const H = PAD.top + PANEL_H * 2 + PAD.gap + PAD.bottom;

export const CHART_SIZE = { width: W, height: H };

// ---------------------------------------------------------------------------
// Simulated series (fixture mode, or when the engine has no stats yet), mirroring tools/simulate.ts
// ---------------------------------------------------------------------------

interface Cohort {
  day: number;
  count: number;
  room: "Housing" | "Other";
  recalled: boolean;
}

const L0_BYTES = 150_000;
const LEVEL_SCALE: Record<Level, number> = { L0: 1, L1: 1 / 4, L2: 1 / 16, L3: 1 / 64 };
const RECALL_DAYS = [3, 6, 13, 18];

function cohorts(): Cohort[] {
  const out: Cohort[] = [{ day: 1, count: 15, room: "Other", recalled: false }];
  for (const day of [2, 5]) {
    out.push({ day, count: 14, room: "Housing", recalled: true });
    out.push({ day, count: 26, room: "Housing", recalled: false });
  }
  for (let day = 3; day <= 20; day++) out.push({ day, count: 10, room: "Other", recalled: false });
  return out;
}

function recallState(created: number, onDay: number): { recalls: number; lastRecallDay: number } {
  const applied = RECALL_DAYS.filter((d) => d > created && d <= onDay);
  return { recalls: applied.length, lastRecallDay: applied.length ? Math.max(...applied) : created };
}

/** Bytes per strategy for days 1..lastDay from the spec's model of Maya's month. */
export function simulatedRows(lastDay = 30): DayRow[] {
  const rows: DayRow[] = [];
  const groups = cohorts();
  for (let day = 1; day <= lastDay; day++) {
    const bytes: Record<Condition, number> = { cortex: 0, keep_all: 0, blur_by_age: 0 };
    for (const g of groups) {
      if (g.day > day) continue;
      for (const cond of ["cortex", "keep_all", "blur_by_age"] as const) {
        const rs = cond === "cortex" && g.recalled ? recallState(g.day, day) : { recalls: 0, lastRecallDay: g.day };
        const alive = aliveLevelsOn(cond, day, rs.lastRecallDay, rs.recalls, DEFAULT_PARAMS);
        bytes[cond] += g.count * alive.reduce((sum, lvl) => sum + Math.round(L0_BYTES * LEVEL_SCALE[lvl]), 0);
      }
    }
    rows.push({ day, bytes });
  }
  return rows;
}

/** Engine `/stats` rows (any subset of conditions) folded into chart rows plus accuracy points. */
export function rowsFromStats(stats: ReadonlyArray<{ condition: Condition; day: number; image_bytes: number; belief_bytes: number; accuracy_weighted: number | null }>): {
  rows: DayRow[];
  accuracy: AccuracyRow[] | null;
} {
  const byDay = new Map<number, Record<Condition, number>>();
  const accuracy: AccuracyRow[] = [];
  for (const r of stats) {
    const row = byDay.get(r.day) ?? { cortex: 0, keep_all: 0, blur_by_age: 0 };
    row[r.condition] = r.image_bytes + r.belief_bytes;
    byDay.set(r.day, row);
    if (r.accuracy_weighted !== null) accuracy.push({ condition: r.condition, day: r.day, accuracy_weighted: r.accuracy_weighted });
  }
  const rows = [...byDay.entries()].sort((a, b) => a[0] - b[0]).map(([day, bytes]) => ({ day, bytes }));
  return { rows, accuracy: accuracy.length ? accuracy : null };
}

// ---------------------------------------------------------------------------
// SVG
// ---------------------------------------------------------------------------

interface Scale {
  x(day: number): number;
  y(v: number): number;
}

function scale(top: number, xDays: number, yMax: number): Scale {
  const plotW = W - PAD.left - PAD.right;
  const span = Math.max(1, xDays - 1);
  return {
    x: (day) => PAD.left + ((day - 1) / span) * plotW,
    y: (v) => top + PANEL_H - (v / yMax) * PANEL_H,
  };
}

function path(points: Array<[number, number]>): string {
  return points.map(([x, y], i) => `${i ? "L" : "M"}${x.toFixed(1)} ${y.toFixed(1)}`).join(" ");
}

function niceMax(v: number): number {
  if (!(v > 0)) return 1;
  const pow = Math.pow(10, Math.floor(Math.log10(v)));
  const n = v / pow;
  const step = n <= 1 ? 1 : n <= 2 ? 2 : n <= 5 ? 5 : 10;
  return step * pow;
}

function esc(text: string): string {
  return text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
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
  parts.push(`<text x="${PAD.left}" y="${opts.top - 14}" font-size="15" font-weight="600" fill="${INK.primary}">${esc(opts.title)}</text>`);
  for (const t of opts.yTicks) {
    const y = s.y(t);
    parts.push(`<line x1="${PAD.left}" x2="${W - PAD.right}" y1="${y.toFixed(1)}" y2="${y.toFixed(1)}" stroke="${INK.grid}" stroke-width="1"/>`);
    parts.push(`<text x="${PAD.left - 10}" y="${(y + 4).toFixed(1)}" font-size="12" text-anchor="end" fill="${INK.muted}">${opts.yFormat(t)}</text>`);
  }
  parts.push(`<line x1="${PAD.left}" x2="${W - PAD.right}" y1="${s.y(0)}" y2="${s.y(0)}" stroke="${INK.axis}" stroke-width="1"/>`);
  parts.push(`<text x="${PAD.left - 10}" y="${opts.top - 14}" font-size="11" text-anchor="end" fill="${INK.muted}">${esc(opts.unit)}</text>`);
  if (opts.note) {
    parts.push(`<text x="${(PAD.left + (W - PAD.right)) / 2}" y="${opts.top + PANEL_H / 2}" font-size="14" text-anchor="middle" fill="${INK.secondary}">${esc(opts.note)}</text>`);
  }
  for (const line of opts.lines) {
    if (line.points.length === 0) continue;
    const pts = line.points.map(([d, v]) => [s.x(d), s.y(v)] as [number, number]);
    parts.push(`<path d="${path(pts)}" fill="none" stroke="${line.color}" stroke-width="2" stroke-linejoin="round" stroke-linecap="round"/>`);
    const last = pts[pts.length - 1]!;
    parts.push(`<circle cx="${last[0].toFixed(1)}" cy="${last[1].toFixed(1)}" r="4" fill="${line.color}" stroke="${INK.surface}" stroke-width="2"/>`);
    parts.push(`<text x="${(last[0] + 10).toFixed(1)}" y="${(last[1] + 4).toFixed(1)}" font-size="12" fill="${INK.secondary}">${esc(line.label)}</text>`);
  }
  return parts.join("\n");
}

/** Inner SVG markup (no outer `<svg>`), so the page can size it responsively. */
export function renderChartBody(rows: DayRow[], accuracy: AccuracyRow[] | null, checkpoints: readonly number[] = CHECKPOINT_DAYS): string {
  const days = Math.max(1, rows.length);
  const bytesMax = niceMax(Math.max(0, ...rows.map((r) => Math.max(r.bytes.cortex, r.bytes.keep_all, r.bytes.blur_by_age))) / 1e6);
  const bytesTicks = [0, bytesMax / 4, bytesMax / 2, (bytesMax * 3) / 4, bytesMax];
  const top1 = PAD.top;
  const top2 = PAD.top + PANEL_H + PAD.gap;

  const bytesLines = SERIES.map((se) => ({ color: se.color, label: se.label, points: rows.map((r) => [r.day, r.bytes[se.condition] / 1e6] as [number, number]) }));
  const accLines = SERIES.map((se) => ({
    color: se.color,
    label: se.label,
    points: (accuracy ?? [])
      .filter((a) => a.condition === se.condition)
      .sort((a, b) => a.day - b.day)
      .map((a) => [a.day, a.accuracy_weighted * 100] as [number, number]),
  }));

  const xAxis = scale(0, days, 1);
  const xLabels = Array.from({ length: days }, (_, i) => i + 1)
    .filter((d) => d === 1 || d % 5 === 0)
    .map((d) => `<text x="${xAxis.x(d).toFixed(1)}" y="${H - PAD.bottom + 20}" font-size="12" text-anchor="middle" fill="${INK.muted}">${d}</text>`)
    .join("\n");
  const checkpointMarks = checkpoints
    .filter((d) => d <= days)
    .map((d) => `<line x1="${xAxis.x(d).toFixed(1)}" x2="${xAxis.x(d).toFixed(1)}" y1="${top2}" y2="${top2 + PANEL_H}" stroke="${INK.grid}" stroke-width="1" stroke-dasharray="2 4"/>`)
    .join("\n");
  const legend = SERIES.map((se, i) => {
    const x = PAD.left + i * 170;
    return `<rect x="${x}" y="${H - 16}" width="12" height="12" rx="2" fill="${se.color}"/><text x="${x + 18}" y="${H - 6}" font-size="12" fill="${INK.secondary}">${esc(se.label)}</text>`;
  }).join("\n");

  return [
    `<rect width="${W}" height="${H}" fill="${INK.surface}"/>`,
    `<text x="${PAD.left}" y="28" font-size="13" fill="${INK.secondary}">Cortex gets keep-everything's accuracy at a fraction of the storage. Simulated days 1–${days}.</text>`,
    panel({ top: top1, title: "Bytes stored", unit: "MB", yMax: bytesMax, yTicks: bytesTicks, yFormat: (v) => v.toFixed(0), lines: bytesLines, days }),
    checkpointMarks,
    panel({
      top: top2,
      title: "Weighted answer accuracy",
      unit: "%",
      yMax: 100,
      yTicks: [0, 25, 50, 75, 100],
      yFormat: (v) => v.toFixed(0),
      lines: accLines,
      days,
      ...(accuracy ? {} : { note: "Evaluation pending: accuracy is measured on days 5, 10, 15, 20, 25 and 30" }),
    }),
    `<text x="${(PAD.left + (W - PAD.right)) / 2}" y="${H - PAD.bottom + 40}" font-size="12" text-anchor="middle" fill="${INK.muted}">simulated day</text>`,
    xLabels,
    legend,
  ].join("\n");
}

/** Self-contained SVG document, identical to tools/chart.ts output. */
export function renderChart(rows: DayRow[], accuracy: AccuracyRow[] | null, checkpoints: readonly number[] = CHECKPOINT_DAYS): string {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" font-family="system-ui, -apple-system, Segoe UI, sans-serif">\n${renderChartBody(rows, accuracy, checkpoints)}\n</svg>\n`;
}
