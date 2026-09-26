/**
 * The evaluation question set: 20 used often, 20 seen once, 10 rare but important.
 * Seen-once questions target details that exist only in a screenshot and die with its resolution.
 */
import type { Listing, Question, UsageLogEntry } from "@cortex/schema";
import { TRUE_BUDGET, decide } from "./index-helpers.js";
import { FACTS } from "./life.js";
import { HUNT_DAYS } from "./script.js";
import type { Rng } from "./prng.js";

function q(id: string, group: Question["group"], question: string, answer: string, grading: Question["grading"], extra: Partial<Question> = {}): Question {
  return { id, group, question, answer, grading, ...extra };
}

function detail(listing: Listing, re: RegExp): string {
  const m = listing.description.match(re);
  return m?.[1] ?? "";
}

export function generateQuestions(rng: Rng, listings: Listing[]): Question[] {
  const hunt1 = listings.filter((l) => l.hunt === "hunt1");
  const hunt2 = listings.filter((l) => l.hunt === "hunt2");
  const messaged1 = hunt1.filter((l) => decide(l, HUNT_DAYS.hunt1) === "messaged");
  const rejected1 = hunt1.filter((l) => decide(l, HUNT_DAYS.hunt1) === "rejected");
  const messaged2 = hunt2.filter((l) => decide(l, HUNT_DAYS.hunt2) === "messaged");
  const opened = [...hunt1, ...hunt2].filter((l) => decide(l, 5) !== "unopened");
  const pool = listings.filter((l) => l.hunt === "pool");

  const used: Question[] = [
    q("u01", "used_often", "What is Maya's maximum monthly rent?", `$${TRUE_BUDGET.toLocaleString()}`, "exact"),
    q("u02", "used_often", "Does Maya require laundry in the building?", "Yes", "exact"),
    q("u03", "used_often", "What is Maya's rule about walk-up apartments?", "No walk-ups above the 3rd floor unless there is an elevator", "judge"),
    q("u04", "used_often", "Which subway line does Maya want to live near?", "The L", "exact"),
    q("u05", "used_often", "Where is Maya's new job?", "Near Union Square, at Studio Kite", "judge"),
    q("u06", "used_often", "When does Maya move in / start work?", "Sept 1 move-in, first day Sept 2", "judge"),
    q("u07", "used_often", "Which city is Maya moving from?", "Chicago", "exact"),
    q("u08", "used_often", "What is Maya's profession?", "Product designer", "exact"),
    q("u09", "used_often", "When is Priya's birthday dinner?", `Day ${FACTS.friendDinnerDay} (Sept ${FACTS.friendDinnerDay}) at ${FACTS.friendDinnerTime}`, "judge"),
    q("u10", "used_often", "Where is Priya's birthday dinner?", FACTS.friendDinnerPlace, "exact"),
    q("u11", "used_often", "What time is the recurring design review?", FACTS.designReviewTime, "exact"),
    q("u12", "used_often", "Who is Maya's manager?", FACTS.managerName, "exact"),
    q("u13", "used_often", "What time does Maya go to the gym?", FACTS.gymTime, "exact"),
    q("u14", "used_often", "Which gym did Maya join?", FACTS.gymName, "exact"),
    q("u15", "used_often", "How many landlords did Maya message in her first apartment hunt?", String(messaged1.length), "exact"),
    q("u16", "used_often", "Which neighborhoods has Maya been searching in?", "Bushwick, Williamsburg, East Williamsburg, Ridgewood (along the L)", "judge"),
    q("u17", "used_often", "How does Maya sign off or introduce herself to landlords?", "As Maya, moving Sept 1 for a job near Union Square; asks about laundry and a viewing", "judge"),
    q("u18", "used_often", "Which listing did Maya message in Williamsburg during hunt 2, if any?", messaged2.find((l) => l.neighborhood === "Williamsburg")?.title ?? "None", "judge"),
    q("u19", "used_often", "Does Maya accept apartments on high floors if there is an elevator?", "Yes", "exact"),
    q("u20", "used_often", "Does Maya currently need a pet-friendly apartment? (as of day 20)", "No", "exact"),
  ];

  const seenPick = rng.shuffle(opened).slice(0, 12);
  const poolPick = rng.shuffle(pool).slice(0, 4);
  const seen: Question[] = [];
  let n = 1;
  const sid = (): string => `s${String(n++).padStart(2, "0")}`;
  for (const l of seenPick.slice(0, 5)) {
    seen.push(q(sid(), "seen_once", `What was the unit number of ${l.title} (${l._id})?`, detail(l, /unit (\w+)\./), "exact", { evidence_capture_hint: l._id, survives_at: "L1" }));
  }
  for (const l of seenPick.slice(5, 9)) {
    seen.push(q(sid(), "seen_once", `What color were the kitchen cabinets in ${l._id}?`, detail(l, /Kitchen with ([\w ]+) cabinets/), "exact", { evidence_capture_hint: l._id, survives_at: "L1" }));
  }
  for (const l of seenPick.slice(9, 12)) {
    seen.push(q(sid(), "seen_once", `What street was ${l._id} on?`, detail(l, /at (\d+ [\w ]+), unit/), "exact", { evidence_capture_hint: l._id, survives_at: "L1" }));
  }
  for (const l of poolPick) {
    seen.push(q(sid(), "seen_once", `What was the listed price of ${l._id} in the search results?`, `$${l.price.toLocaleString()}`, "exact", { evidence_capture_hint: l._id, survives_at: "L2" }));
  }
  for (const [i, subj] of FACTS.newsletterSubjects.entries()) {
    if (i >= 3) break;
    seen.push(q(sid(), "seen_once", `What was the subject of the Design Systems Weekly newsletter on day ${FACTS.newsletterDays[i]}?`, subj, "judge", { evidence_capture_hint: `inbox:newsletter:day${FACTS.newsletterDays[i]}`, survives_at: "L1" }));
  }
  seen.push(q(sid(), "seen_once", `Which floor was the rejected walk-up ${rejected1.find((l) => l.trap === "walkup")?._id ?? rejected1[0]?._id} on?`, String(rejected1.find((l) => l.trap === "walkup")?.floor ?? rejected1[0]?.floor), "exact", { evidence_capture_hint: rejected1.find((l) => l.trap === "walkup")?._id ?? "", survives_at: "L2" }));

  const rare: Question[] = [
    q("r01", "rare_important", "When is Maya's lease signing?", FACTS.leaseSigningDate, "exact"),
    q("r02", "rare_important", "What is the address on Maya's lease?", FACTS.leaseAddress, "exact"),
    q("r03", "rare_important", "How much is the security deposit?", FACTS.leaseDeposit, "exact"),
    q("r04", "rare_important", "Who is the leasing broker?", FACTS.leaseBroker, "exact"),
    q("r05", "rare_important", "What should Maya bring to the lease signing?", "Photo ID and a bank statement", "judge"),
    q("r06", "rare_important", "What is Maya's gym member number?", "RB-40917", "exact"),
    q("r07", "rare_important", "When is Maya's dentist appointment?", `Day ${FACTS.dentistDay} at ${FACTS.dentistTime}`, "judge"),
    q("r08", "rare_important", "What did Maya give Priya for her birthday?", FACTS.birthdayGift, "judge"),
    q("r09", "rare_important", "When is Maya's flight to Chicago and what is the confirmation code?", `Day ${FACTS.flightHomeDay} at ${FACTS.flightHomeTime}, MWY7Q2`, "judge"),
    q("r10", "rare_important", "When was Maya's first 1:1 with her manager?", `Day ${FACTS.oneOnOneDay} at ${FACTS.oneOnOneTime}`, "judge"),
  ];

  return [...used, ...seen.slice(0, 20), ...rare];
}

/** What Maya asks and runs on which days. Housing recalls fall on the simulator's schedule. */
export function generateUsageLog(): UsageLogEntry[] {
  return [
    { day: 3, kind: "question", text: "Remind me which of yesterday's places had laundry in the building", rooms: ["Housing"] },
    { day: 6, kind: "question", text: "What's my rent ceiling again, and which listings did I message this week?", rooms: ["Housing"] },
    { day: 7, kind: "question", text: "When and where is Priya's birthday dinner?", rooms: ["Social"] },
    { day: 10, kind: "question", text: "What time is design review tomorrow?", rooms: ["Work"] },
    { day: 12, kind: "question", text: "What's my gym schedule this week?", rooms: ["Health"] },
    { day: 13, kind: "question", text: "Which apartments did I skip because of the walk-up thing?", rooms: ["Housing"] },
    { day: 16, kind: "question", text: "Who is my manager and when is our next review?", rooms: ["Work"] },
    { day: 18, kind: "question", text: "Show me the places near the L I liked, I want to follow up", rooms: ["Housing"] },
    { day: 21, kind: "question", text: "Did any landlord I messaged reply about laundry?", rooms: ["Housing"] },
    { day: 24, kind: "task", text: "Find me apartments", rooms: ["Housing"] },
    { day: 25, kind: "task", text: "Find me apartments (after the dog voice note)", rooms: ["Housing"] },
  ];
}
