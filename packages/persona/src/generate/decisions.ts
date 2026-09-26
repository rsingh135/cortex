/**
 * What Maya does with each listing, derived from her hidden rules. This is the ground truth the
 * learner must recover, so it lives here and nowhere in the engine.
 */
import type { GroundTruth, Listing } from "@cortex/schema";
import { TRUE_BUDGET } from "./listings.js";

export type Outcome = "unopened" | "rejected" | "messaged";

export const TRUE_RULES: GroundTruth["rules"] = [
  { attr: "price", op: "<=", value: TRUE_BUDGET, active_from_day: 1 },
  { attr: "laundry", op: "==", value: true, active_from_day: 1 },
  { attr: "walkup_floor", op: "<=", value: 3, active_from_day: 1 },
  { attr: "train", op: "==", value: "L", active_from_day: 1 },
  { attr: "pets", op: "==", value: true, active_from_day: 25 },
];

export const STYLE =
  "Short and friendly. Introduces herself as Maya, mentions a Sept 1 move-in for a job near Union Square, always asks whether the building has laundry, and asks for a viewing this week.";

/** Maya's decision about a listing on a given simulated day. */
export function decide(listing: Listing, day: number): Outcome {
  if (listing.price > TRUE_BUDGET) return "unopened";
  const rules = TRUE_RULES.filter((r) => r.active_from_day <= day && r.attr !== "price");
  const violates = rules.some((r) => {
    const v = listing[r.attr as keyof Listing];
    switch (r.op) {
      case "<=":
        return typeof v === "number" && typeof r.value === "number" && !(v <= r.value);
      case ">=":
        return typeof v === "number" && typeof r.value === "number" && !(v >= r.value);
      case "==":
        return v !== r.value;
      case "!=":
        return v === r.value;
      case "in":
        return !(Array.isArray(r.value) && typeof v === "string" && r.value.includes(v));
    }
  });
  return violates ? "rejected" : "messaged";
}

/** The landlord message Maya would send, in her voice. */
export function draftMessage(listing: Listing): string {
  const first = listing.landlord.split(" ")[0];
  return `Hi ${first}! I'm Maya, moving to New York Sept 1 for a new job near Union Square. Is the ${listing.title.toLowerCase()} still available? Does the building have laundry? I'd love to see it this week if possible. Thanks!`;
}
