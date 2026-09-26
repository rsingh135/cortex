/**
 * Forgetting simulator. Runs the shared forgetting math over a model of Maya's month for all three
 * conditions, prints bytes per day, checks the demo-beat assertions, and suggests usage-log recall
 * days that keep recalled housing screenshots sharp until the live hunt on day 24.
 *
 *   pnpm simulate            default parameters and usage log
 *   pnpm simulate --json     machine-readable output
 */
import {
  DEFAULT_PARAMS,
  LEVELS,
  aliveLevelsOn,
  ceilingOf,
  clarity,
  confidence,
  expiresDay,
  type Condition,
  type Level,
  type Params,
} from "@cortex/schema";

// ---------------------------------------------------------------------------
// Model of the month
// ---------------------------------------------------------------------------

export interface CaptureGroup {
  label: string;
  room: string;
  day: number;
  count: number;
  /** Fraction of this group's captures that usage-log recalls touch (evidence of used beliefs). */
  recalledFraction: number;
}

export interface SimInput {
  groups: CaptureGroup[];
  /** Days on which the usage log recalls housing memories. */
  housingRecallDays: number[];
  lastDay: number;
  liveHuntDay: number;
  /** Average WebP L0 bytes at 1280x800. Lower levels scale by area. */
  l0Bytes: number;
  params: Params;
}

export const DEFAULT_INPUT: SimInput = {
  groups: [
    { label: "day1 setup (inbox/calendar)", room: "Work", day: 1, count: 15, recalledFraction: 0 },
    { label: "hunt1", room: "Housing", day: 2, count: 40, recalledFraction: 0.35 },
    { label: "hunt2", room: "Housing", day: 5, count: 40, recalledFraction: 0.35 },
    ...Array.from({ length: 18 }, (_, i) => ({
      label: `life day ${i + 3}`,
      room: "Work/Social/Misc",
      day: i + 3,
      count: 10,
      recalledFraction: 0,
    })),
  ],
  housingRecallDays: [3, 6, 13, 18],
  lastDay: 30,
  liveHuntDay: 24,
  l0Bytes: 150_000,
  params: DEFAULT_PARAMS,
};

const CONDITIONS: Condition[] = ["cortex", "keep_all", "blur_by_age"];

export function levelBytes(level: Level, l0Bytes: number): number {
  const scale: Record<Level, number> = { L0: 1, L1: 1 / 4, L2: 1 / 16, L3: 1 / 64 };
  return Math.round(l0Bytes * scale[level]);
}

/** Recall state of a capture created on `day` given the housing recall schedule (cortex only). */
export function recallStateOn(createdDay: number, recallDays: readonly number[], onDay: number): { recalls: number; lastRecallDay: number } {
  const applied = recallDays.filter((d) => d > createdDay && d <= onDay);
  return { recalls: applied.length, lastRecallDay: applied.length ? Math.max(...applied) : createdDay };
}

export interface DayRow {
  day: number;
  bytes: Record<Condition, number>;
  forgotten: Record<Condition, number>;
}

export function simulate(input: SimInput): DayRow[] {
  const rows: DayRow[] = [];
  for (let day = 1; day <= input.lastDay; day++) {
    const bytes: Record<Condition, number> = { cortex: 0, keep_all: 0, blur_by_age: 0 };
    const forgotten: Record<Condition, number> = { cortex: 0, keep_all: 0, blur_by_age: 0 };
    for (const g of input.groups) {
      if (g.day > day) continue;
      const recalledCount = Math.round(g.count * g.recalledFraction);
      const cohorts: Array<{ n: number; recalled: boolean }> = [
        { n: recalledCount, recalled: true },
        { n: g.count - recalledCount, recalled: false },
      ];
      for (const cond of CONDITIONS) {
        for (const cohort of cohorts) {
          if (cohort.n === 0) continue;
          // Only cortex lets a recall reset the clock; the baselines anchor on the creation day.
          const rs =
            cond === "cortex" && cohort.recalled && g.room === "Housing"
              ? recallStateOn(g.day, input.housingRecallDays, day)
              : { recalls: 0, lastRecallDay: g.day };
          const alive = aliveLevelsOn(cond, day, rs.lastRecallDay, rs.recalls, input.params);
          const perCapture = alive.reduce((sum, lvl) => sum + levelBytes(lvl, input.l0Bytes), 0);
          bytes[cond] += perCapture * cohort.n;
          if (alive.length === 0) forgotten[cond] += cohort.n;
        }
      }
    }
    rows.push({ day, bytes, forgotten });
  }
  return rows;
}

/**
 * Greedy schedule: recall the day before L0 would expire, until L0 survives past `untilDay`.
 * This is the minimal usage log that keeps a day-`createdDay` screenshot at full resolution.
 */
export function suggestRecallDays(createdDay: number, untilDay: number, p: Params): number[] {
  const days: number[] = [];
  let recalls = 0;
  let last = createdDay;
  while (expiresDay("L0", last, recalls, p) <= untilDay) {
    const recallDay = expiresDay("L0", last, recalls, p) - 1;
    if (recallDay <= last) return days; // cannot keep up; base lifetime too short
    days.push(recallDay);
    recalls += 1;
    last = recallDay;
  }
  return days;
}

// ---------------------------------------------------------------------------
// Assertions tied to the demo beats
// ---------------------------------------------------------------------------

export interface Assertion {
  name: string;
  ok: boolean;
  detail: string;
}

export function assertions(input: SimInput): Assertion[] {
  const p = input.params;
  const out: Assertion[] = [];
  const hunt1 = input.groups.find((g) => g.label === "hunt1")!;
  const rs = recallStateOn(hunt1.day, input.housingRecallDays, input.liveHuntDay);

  const cortexAlive = aliveLevelsOn("cortex", input.liveHuntDay, rs.lastRecallDay, rs.recalls, p);
  out.push({
    name: "A. Cortex keeps L0 or L1 of a recalled day-2 housing capture at the live hunt",
    ok: cortexAlive.includes("L0") || cortexAlive.includes("L1"),
    detail: `alive ${JSON.stringify(cortexAlive)}, clarity ${clarity("cortex", ceilingOf(cortexAlive), input.liveHuntDay - rs.lastRecallDay, rs.recalls, p).toFixed(2)} after ${rs.recalls} recalls`,
  });

  const blurAlive = aliveLevelsOn("blur_by_age", input.liveHuntDay, hunt1.day, 0, p);
  out.push({
    name: "B. blur_by_age holds at most L3 of the same capture at the live hunt",
    ok: blurAlive.every((l) => l === "L3"),
    detail: `alive ${JSON.stringify(blurAlive)}`,
  });

  const lifeDay8 = aliveLevelsOn("cortex", input.liveHuntDay, 8, 0, p);
  const lifeDay8End = aliveLevelsOn("cortex", input.lastDay, 8, 0, p);
  out.push({
    name: "C. Unrecalled day-8 life capture is thumbnail-only by the live hunt and gone by month end",
    ok: lifeDay8.every((l) => l === "L3") && lifeDay8End.length === 0,
    detail: `day ${input.liveHuntDay}: ${JSON.stringify(lifeDay8)}; day ${input.lastDay}: ${JSON.stringify(lifeDay8End)}`,
  });

  const unrecalledHunt1 = aliveLevelsOn("cortex", input.liveHuntDay, hunt1.day, 0, p);
  out.push({
    name: "D. Unrecalled day-2 housing captures are fully forgotten at the live hunt (the empty frame)",
    ok: unrecalledHunt1.length === 0,
    detail: `alive ${JSON.stringify(unrecalledHunt1)}`,
  });

  const voice = confidence("cortex", p.c0.voice, input.lastDay - 25, 0, { humanSourced: true }, p);
  out.push({
    name: "E. Voice belief from day 25 is still above 0.5 at month end",
    ok: voice > 0.5,
    detail: `confidence ${voice.toFixed(3)}`,
  });

  const prefCreated = 5;
  const prefRecalls = recallStateOn(prefCreated, input.housingRecallDays, input.liveHuntDay);
  const pref = confidence("cortex", 0.8, input.liveHuntDay - prefRecalls.lastRecallDay, prefRecalls.recalls, {}, p);
  const prefBlur = confidence("blur_by_age", 0.8, input.liveHuntDay - prefCreated, 0, {}, p);
  out.push({
    name: "F. Learned preference (c0 0.8, day 5) stays above 0.6 under Cortex and drops under blur_by_age",
    ok: pref > 0.6 && prefBlur < pref,
    detail: `cortex ${pref.toFixed(3)} vs blur_by_age ${prefBlur.toFixed(3)}`,
  });

  const rows = simulate(input);
  const last = rows[rows.length - 1]!;
  out.push({
    name: "G. Cortex ends the month under 25% of keep_all bytes",
    ok: last.bytes.cortex < 0.25 * last.bytes.keep_all,
    detail: `cortex ${mb(last.bytes.cortex)} vs keep_all ${mb(last.bytes.keep_all)} vs blur_by_age ${mb(last.bytes.blur_by_age)}`,
  });

  return out;
}

function mb(b: number): string {
  return `${(b / 1_000_000).toFixed(1)}MB`;
}

// ---------------------------------------------------------------------------
// CLI
// ---------------------------------------------------------------------------

function main(): void {
  const input = DEFAULT_INPUT;
  const json = process.argv.includes("--json");
  const rows = simulate(input);
  const checks = assertions(input);
  const suggested = suggestRecallDays(2, input.liveHuntDay, input.params);

  if (json) {
    console.log(JSON.stringify({ params: input.params, rows, assertions: checks, suggestedRecallDays: suggested }, null, 2));
  } else {
    console.log("Parameters");
    for (const lvl of LEVELS) console.log(`  ${lvl}: base ${input.params.levelBaseDays[lvl]}d, value ${input.params.levelValue[lvl]}`);
    console.log(`  recall multiplier min(2^r, ${input.params.recallCap}); clarity half-life ${(Math.LN2 / input.params.lambdaClarity).toFixed(0)}d; belief half-life ${(Math.LN2 / input.params.lambdaBelief).toFixed(0)}d`);
    console.log(`\nUsage log housing recall days: ${JSON.stringify(input.housingRecallDays)}`);
    console.log(`Minimal schedule keeping a day-2 L0 alive to day ${input.liveHuntDay}: ${JSON.stringify(suggested)}`);
    console.log("\nBytes stored (MB) and fully-forgotten captures");
    console.log("  day   cortex  keep_all  blur_by_age   forgotten(cortex/blur)");
    for (const r of rows) {
      if (r.day % 5 !== 0 && r.day !== 1 && r.day !== input.liveHuntDay) continue;
      console.log(
        `  ${String(r.day).padStart(3)}  ${(r.bytes.cortex / 1e6).toFixed(1).padStart(7)}  ${(r.bytes.keep_all / 1e6).toFixed(1).padStart(8)}  ${(r.bytes.blur_by_age / 1e6).toFixed(1).padStart(11)}   ${r.forgotten.cortex}/${r.forgotten.blur_by_age}`,
      );
    }
    console.log("\nAssertions");
    for (const a of checks) console.log(`  ${a.ok ? "PASS" : "FAIL"}  ${a.name}\n        ${a.detail}`);
  }
  if (checks.some((a) => !a.ok)) process.exit(1);
}

if (process.argv[1] && /simulate\.ts$/.test(process.argv[1])) main();
