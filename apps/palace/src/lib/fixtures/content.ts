/**
 * Text for Maya's month. Templates are picked deterministically by the generator; `{n}` style
 * placeholders are filled from the small pools below so ~120 beliefs read as distinct.
 */
import type { App, Kind, Room } from "@cortex/schema";

export interface BeliefTemplate {
  kind: Kind;
  text: string;
  /** Preferred capture app for evidence. */
  app?: App;
}

export const HOUSING_RECALL_DAYS = [3, 6, 13, 18] as const;

export const NEIGHBORHOODS = ["Bushwick", "Williamsburg", "Ridgewood", "Greenpoint", "East Williamsburg", "Bed-Stuy"] as const;
export const TRAINS = ["L", "L", "L", "G", "M", "J"] as const;
export const LANDLORDS = ["Tom Reyes", "Ana Petrov", "Marcus Hill", "Dee Okafor", "Lena Marsh", "Ravi Nair"] as const;

export const REJECTION_REASONS = ["fifth-floor walk-up", "no laundry in the building", "over budget at $3,150", "off the L, on the G", "fourth-floor walk-up", "laundromat only"] as const;

export const WORK_TEMPLATES: BeliefTemplate[] = [
  { kind: "fact", text: "Works at Northwind Studio as a product designer", app: "inbox" },
  { kind: "fact", text: "Office is on 14th St by Union Square", app: "inbox" },
  { kind: "fact", text: "Starts the new role on Sept 2", app: "calendar" },
  { kind: "routine", text: "Design review every Tuesday at 10am", app: "calendar" },
  { kind: "routine", text: "Team standup daily at 9:30", app: "calendar" },
  { kind: "person", text: "Dana Whitfield is Maya's manager", app: "inbox" },
  { kind: "person", text: "Leo Park is the engineer on the onboarding squad", app: "inbox" },
  { kind: "person", text: "Marisol Vega runs product for growth", app: "inbox" },
  { kind: "event", text: "Design review on day {d} covered the onboarding flow", app: "calendar" },
  { kind: "event", text: "Dana asked for the settings redesign by day {d2}", app: "inbox" },
  { kind: "event", text: "Leo shipped the empty-state fix on day {d}", app: "inbox" },
  { kind: "event", text: "Skipped standup on day {d} for a viewing", app: "calendar" },
  { kind: "event", text: "Sent the Q4 roadmap draft to Marisol on day {d}", app: "inbox" },
  { kind: "event", text: "Booked the big conference room for day {d2}", app: "calendar" },
  { kind: "event", text: "Flagged the checkout copy bug in #design on day {d}", app: "inbox" },
  { kind: "event", text: "Benefits enrollment reminder arrived on day {d}", app: "inbox" },
  { kind: "event", text: "1:1 with Dana moved to Thursdays", app: "calendar" },
  { kind: "event", text: "Design system audit kickoff on day {d}", app: "calendar" },
  { kind: "summary", text: "Day {d}: cleared the inbox, replied to Dana, reviewed Leo's PR" },
  { kind: "summary", text: "Day {d}: two design reviews and a roadmap draft" },
  { kind: "summary", text: "Day {d}: calendar tidy-up; moved the 1:1" },
  { kind: "summary", text: "Day {d}: onboarding flow feedback round" },
  { kind: "fact", text: "Uses Figma and Linear at work", app: "inbox" },
  { kind: "fact", text: "Payroll runs on the 15th and the last day of the month", app: "inbox" },
];

export const SOCIAL_TEMPLATES: BeliefTemplate[] = [
  { kind: "event", text: "Priya's birthday dinner is Oct 3 at Lilia", app: "calendar" },
  { kind: "person", text: "Priya Raman is Maya's closest friend from Chicago", app: "inbox" },
  { kind: "person", text: "Sam Ortiz lives in Greenpoint and knows the landlords there", app: "inbox" },
  { kind: "person", text: "Jordan Lee suggested a rooftop movie night", app: "inbox" },
  { kind: "routine", text: "Sunday evening call with mom", app: "calendar" },
  { kind: "event", text: "Rooftop movie night on day {d}", app: "calendar" },
  { kind: "event", text: "Coffee with Sam on day {d} to talk neighborhoods", app: "calendar" },
  { kind: "event", text: "Priya sent a Brooklyn moving checklist on day {d}", app: "inbox" },
  { kind: "event", text: "Group chat picked the Oct 3 dinner spot on day {d}", app: "inbox" },
  { kind: "event", text: "Housewarming invite from Jordan for day {d2}", app: "inbox" },
  { kind: "event", text: "Mom asked about the lease on day {d}", app: "inbox" },
  { kind: "summary", text: "Day {d}: caught up with Priya and Sam" },
  { kind: "summary", text: "Day {d}: planned the birthday dinner" },
  { kind: "fact", text: "Prefers dinners at 7:30 on weeknights", app: "calendar" },
  { kind: "fact", text: "Priya is vegetarian", app: "inbox" },
];

export const HEALTH_TEMPLATES: BeliefTemplate[] = [
  { kind: "routine", text: "Gym Mon, Wed, Fri at 7am at Crunch Union Square", app: "calendar" },
  { kind: "routine", text: "Saturday run over the Williamsburg Bridge", app: "calendar" },
  { kind: "event", text: "Dentist appointment on day {d2}", app: "calendar" },
  { kind: "event", text: "Skipped the gym on day {d} (viewing)", app: "calendar" },
  { kind: "event", text: "Physio follow-up booked for day {d2}", app: "calendar" },
  { kind: "fact", text: "Allergy shots every other Thursday", app: "calendar" },
  { kind: "fact", text: "New PCP is at One Medical on 13th St", app: "inbox" },
  { kind: "event", text: "Pharmacy refill reminder on day {d}", app: "inbox" },
  { kind: "summary", text: "Day {d}: gym and a dentist reminder" },
  { kind: "summary", text: "Day {d}: bridge run, physio booked" },
];

export const ERRANDS_TEMPLATES: BeliefTemplate[] = [
  { kind: "event", text: "Renters insurance quote from Lemonade: $14/month", app: "inbox" },
  { kind: "event", text: "USPS change of address filed on day {d}", app: "inbox" },
  { kind: "event", text: "IKEA lamp return due by day {d2}", app: "inbox" },
  { kind: "event", text: "DMV appointment for a NY license on day {d2}", app: "calendar" },
  { kind: "event", text: "Mover quote from Piece of Cake: $1,200", app: "inbox" },
  { kind: "event", text: "Storage unit in Chicago paid through Oct", app: "inbox" },
  { kind: "routine", text: "Groceries at Trader Joe's on Sunday mornings", app: "calendar" },
  { kind: "fact", text: "Bank is Chase; branch on Broadway", app: "inbox" },
  { kind: "event", text: "Ordered a mattress for delivery on day {d2}", app: "inbox" },
  { kind: "event", text: "Library card application on day {d}", app: "inbox" },
  { kind: "summary", text: "Day {d}: insurance and moving quotes" },
  { kind: "summary", text: "Day {d}: address change, DMV booked" },
];

export const MISC_TEMPLATES: BeliefTemplate[] = [
  { kind: "fact", text: "Subscribed to the Are.na newsletter", app: "inbox" },
  { kind: "fact", text: "Listens to the Search Engine podcast", app: "inbox" },
  { kind: "event", text: "NYT digital subscription renewed on day {d}", app: "inbox" },
  { kind: "event", text: "Bookmarked a typography talk for day {d2}", app: "calendar" },
  { kind: "event", text: "Museum members' night on day {d2}", app: "calendar" },
  { kind: "routine", text: "Reads newsletters on Friday afternoons", app: "inbox" },
  { kind: "event", text: "Spotify wrapped-style recap arrived on day {d}", app: "inbox" },
  { kind: "fact", text: "Favorite coffee: Devoción in Williamsburg", app: "inbox" },
  { kind: "event", text: "Signed up for a ceramics class starting day {d2}", app: "inbox" },
  { kind: "summary", text: "Day {d}: newsletters and a class signup" },
  { kind: "summary", text: "Day {d}: quiet day; a few subscriptions" },
  { kind: "event", text: "Weather alert for day {d}: heat advisory", app: "inbox" },
];

export const HOUSING_FACTS: BeliefTemplate[] = [
  { kind: "fact", text: "Moving from Chicago to Brooklyn", app: "inbox" },
  { kind: "fact", text: "Move-in target is Sept 1", app: "landlord_chat" },
  { kind: "fact", text: "Commute target: under 35 minutes to Union Square on the L", app: "mockloft" },
  { kind: "fact", text: "Looking for a one-bedroom", app: "mockloft" },
];

export const HOUSING_PERSONS: BeliefTemplate[] = [
  { kind: "person", text: "Landlord Tom Reyes (listing 231) replies within a day", app: "landlord_chat" },
  { kind: "person", text: "Broker Ana Petrov at Loft & Key handles the Ridgewood units", app: "landlord_chat" },
];

export const ROOM_TEMPLATES: Record<Exclude<Room, "Housing">, BeliefTemplate[]> = {
  Work: WORK_TEMPLATES,
  Social: SOCIAL_TEMPLATES,
  Health: HEALTH_TEMPLATES,
  Errands: ERRANDS_TEMPLATES,
  Misc: MISC_TEMPLATES,
};

export const ROOM_TARGETS: Record<Exclude<Room, "Housing">, number> = { Work: 24, Social: 15, Health: 10, Errands: 12, Misc: 12 };

export const CAPTURE_TITLES: Record<App, string[]> = {
  mockloft: ["MockLoft — {hood} 1BR, ${price}", "MockLoft — listing {id}", "MockLoft — search: {hood}"],
  inbox: ["Inbox — {subject}", "Inbox (12) — {subject}", "Re: {subject} — Inbox"],
  calendar: ["Calendar — week of day {d}", "Calendar — {title}", "Calendar — day {d}"],
  landlord_chat: ["Chat with {landlord}", "Message {landlord} — listing {id}", "Landlord chat — listing {id}"],
  desktop: ["Desktop", "Screen — {subject}"],
};

export const INBOX_SUBJECTS = ["Onboarding flow v3", "Lease documents", "Benefits enrollment", "Design review notes", "Renters insurance quote", "Moving checklist", "Q4 roadmap", "Oct 3 dinner?", "Your DMV appointment", "IKEA return"];
export const CALENDAR_TITLES = ["Design review", "Standup", "Gym", "Viewing: listing {id}", "Dentist", "Priya's birthday dinner", "1:1 with Dana", "Bridge run"];
