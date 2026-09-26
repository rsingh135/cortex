/**
 * Maya's month as Playwright-ready steps. Hunts on days 2 and 5, ordinary life on days 1–20.
 * Every step carries its episode id so capture records carry explicit episode boundaries.
 */
import type { Listing } from "@cortex/schema";
import type { ScriptStep } from "../index.js";
import { decide, draftMessage } from "./decisions.js";
import { FACTS } from "./life.js";
import type { Rng } from "./prng.js";

export const HUNT_DAYS: Record<"hunt1" | "hunt2", number> = { hunt1: 2, hunt2: 5 };

function huntSteps(rng: Rng, listings: Listing[], huntName: "hunt1" | "hunt2"): ScriptStep[] {
  const day = HUNT_DAYS[huntName];
  const episode = `${huntName}-day${day}`;
  const steps: ScriptStep[] = [];
  const shown = rng.shuffle(listings.filter((l) => l.hunt === huntName));
  steps.push({ day, app: "mockloft", episode, action: "open", target: `/listings?hunt=${huntName}`, pause_s: 2 });
  steps.push({ day, app: "mockloft", episode, action: "dwell", target: `/listings?hunt=${huntName}`, pause_s: 12 });
  for (const l of shown) {
    const outcome = decide(l, day);
    if (outcome === "unopened") continue;
    steps.push({ day, app: "mockloft", episode, action: "open", target: `/listings/${l._id}`, pause_s: rng.int(2, 4) });
    steps.push({ day, app: "mockloft", episode, action: "dwell", target: `/listings/${l._id}`, pause_s: rng.int(8, 16) });
    if (outcome === "rejected") {
      steps.push({ day, app: "mockloft", episode, action: "reject", target: l._id, pause_s: rng.int(1, 3) });
    } else {
      steps.push({ day, app: "landlord_chat", episode, action: "message", target: l._id, text: draftMessage(l), pause_s: rng.int(20, 40) });
    }
  }
  return steps;
}

function lifeSteps(rng: Rng): ScriptStep[] {
  const steps: ScriptStep[] = [];
  const day1 = "setup-day1";
  steps.push({ day: 1, app: "inbox", episode: day1, action: "open", target: "/inbox", pause_s: 2 });
  steps.push({ day: 1, app: "inbox", episode: day1, action: "read", target: "welcome", pause_s: 15 });
  steps.push({ day: 1, app: "calendar", episode: day1, action: "open", target: "/calendar", pause_s: 20 });

  for (let day = 2; day <= 20; day++) {
    const episode = `life-day${day}`;
    steps.push({ day, app: "inbox", episode, action: "open", target: "/inbox", pause_s: 2 });
    if (FACTS.designReviewDays.includes(day as (typeof FACTS.designReviewDays)[number])) {
      steps.push({ day, app: "inbox", episode, action: "read", target: "design-review", pause_s: 10 });
      steps.push({ day, app: "calendar", episode, action: "open", target: "/calendar", pause_s: 8 });
    }
    if (day === 2 || day === 7 || day === 9) steps.push({ day, app: "inbox", episode, action: "read", target: "priya", pause_s: 12 });
    if (FACTS.newsletterDays.includes(day as (typeof FACTS.newsletterDays)[number])) steps.push({ day, app: "inbox", episode, action: "read", target: "newsletter", pause_s: 6 });
    if (day === 3) steps.push({ day, app: "inbox", episode, action: "read", target: "gym", pause_s: 6 });
    if (day === FACTS.oneOnOneDay - 1) steps.push({ day, app: "inbox", episode, action: "read", target: "one-on-one", pause_s: 6 });
    if (day === FACTS.dentistDay - 2) steps.push({ day, app: "inbox", episode, action: "read", target: "dentist", pause_s: 5 });
    if (day === FACTS.leaseThreadDay || day === FACTS.leaseThreadDay + 1) steps.push({ day, app: "inbox", episode, action: "read", target: "lease", pause_s: 25 });
    if (rng.chance(0.4)) steps.push({ day, app: "inbox", episode, action: "read", target: `promo-${rng.int(0, 9)}`, pause_s: 3 });
    if (day % 4 === 0) steps.push({ day, app: "calendar", episode, action: "open", target: "/calendar", pause_s: 6 });
  }
  return steps;
}

export function generateScript(rng: Rng, listings: Listing[]): ScriptStep[] {
  const steps = [...lifeSteps(rng), ...huntSteps(rng, listings, "hunt1"), ...huntSteps(rng, listings, "hunt2")];
  return steps.sort((a, b) => a.day - b.day || (a.episode < b.episode ? -1 : a.episode > b.episode ? 1 : 0));
}
