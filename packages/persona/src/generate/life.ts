/**
 * The rest of Maya's month: inbox threads and calendar events. Noise the memory should mostly
 * forget, plus a few things it must keep (Priya's dinner, the design review, the lease).
 */
import type { CalendarEvent, Message } from "@cortex/schema";
import type { Rng } from "./prng";

export const FACTS = {
  managerName: "Sam Okafor",
  friend: "Priya",
  friendDinnerDay: 8,
  friendDinnerTime: "7:30 PM",
  friendDinnerPlace: "Casa Ora",
  designReviewDays: [4, 6, 11, 13, 18, 20],
  designReviewTime: "2:00 PM",
  gymDays: [3, 5, 8, 10, 12, 15, 17, 19],
  gymTime: "7:00 AM",
  gymName: "Ridgewood Barbell",
  leaseThreadDay: 19,
  leaseAddress: "88 Wyckoff Ave, Apt 3B",
  leaseSigningDate: "October 15",
  leaseDeposit: "$2,750",
  leaseBroker: "Elena Vasquez",
  newsletterSubjects: [
    "Design Systems Weekly #212: tokens that survive a rebrand",
    "Design Systems Weekly #213: the case for boring components",
    "Design Systems Weekly #214: accessibility audits in one afternoon",
    "Design Systems Weekly #215: motion that means something",
  ],
  newsletterDays: [2, 9, 16, 23],
  birthdayGift: "a ceramics class voucher",
  oneOnOneDay: 12,
  oneOnOneTime: "11:00 AM",
  dentistDay: 17,
  dentistTime: "9:30 AM",
  flightHomeDay: 27,
  flightHomeTime: "6:15 PM",
  flightHomeAirline: "Midway Air",
} as const;

let seq = 0;
const id = (prefix: string): string => `${prefix}_${String(++seq).padStart(3, "0")}`;

export function generateInbox(rng: Rng): Message[] {
  seq = 0;
  const m: Message[] = [];
  const push = (thread: string, day: number, from: string, subject: string, body: string): void => {
    m.push({ _id: id("msg"), thread_id: thread, kind: "inbox", from, to: "maya@example.com", subject, body, day, sent_by: "world" });
  };

  push("welcome", 1, "hr@studiokite.example", "Welcome to Studio Kite", `Hi Maya, welcome aboard. Your first day is Sept 2 at the Union Square office. Your manager is ${FACTS.managerName}.`);
  for (const d of FACTS.designReviewDays) {
    push("design-review", d, `${FACTS.managerName} <sam@studiokite.example>`, `Design review ${d}`, `Design review today at ${FACTS.designReviewTime} in the Fern room. Bring the onboarding flow.`);
  }
  push("priya", 2, "Priya <priya@example.com>", "You made it!!", `Welcome to NYC! Birthday dinner is Sept ${FACTS.friendDinnerDay} at ${FACTS.friendDinnerPlace}, ${FACTS.friendDinnerTime}. Don't be late.`);
  push("priya", 7, "Priya <priya@example.com>", "Re: You made it!!", `Tomorrow! ${FACTS.friendDinnerPlace} at ${FACTS.friendDinnerTime}. I got us the corner table.`);
  push("priya", 9, "Priya <priya@example.com>", "Thank you", `Best birthday. Thank you for ${FACTS.birthdayGift}, I'm signing up this week.`);
  for (const [i, d] of FACTS.newsletterDays.entries()) {
    push("newsletter", d, "Design Systems Weekly <hello@dsw.example>", FACTS.newsletterSubjects[i]!, "This week: three essays and a tool roundup. Read online.");
  }
  push("gym", 3, `${FACTS.gymName} <front@ridgewoodbarbell.example>`, "Membership confirmed", `Your membership starts today. Member number RB-40917. Morning classes at ${FACTS.gymTime}.`);
  push("one-on-one", FACTS.oneOnOneDay - 1, `${FACTS.managerName} <sam@studiokite.example>`, "1:1 tomorrow", `Let's do our first 1:1 tomorrow at ${FACTS.oneOnOneTime}. Come with questions.`);
  push("dentist", FACTS.dentistDay - 2, "Bright Smile Dental <desk@brightsmile.example>", "Appointment reminder", `Reminder: cleaning on day ${FACTS.dentistDay} at ${FACTS.dentistTime}.`);
  push("lease", FACTS.leaseThreadDay, `${FACTS.leaseBroker} <elena@keystoneleasing.example>`, `Lease for ${FACTS.leaseAddress}`, `Great news, the landlord accepted. Lease signing is ${FACTS.leaseSigningDate} at 10 AM at our office. Security deposit ${FACTS.leaseDeposit}, first month due at signing.`);
  push("lease", FACTS.leaseThreadDay + 1, `${FACTS.leaseBroker} <elena@keystoneleasing.example>`, `Re: Lease for ${FACTS.leaseAddress}`, "Attached: the draft lease. Bring photo ID and a bank statement.");
  push("flight", FACTS.flightHomeDay - 4, `${FACTS.flightHomeAirline} <no-reply@midwayair.example>`, "Your trip to Chicago", `Depart LGA day ${FACTS.flightHomeDay} at ${FACTS.flightHomeTime}. Confirmation MWY7Q2.`);
  for (let i = 0; i < 10; i++) {
    const d = rng.int(2, 22);
    push(`promo-${i}`, d, rng.pick(["Plant Shop <hi@leafy.example>", "Coffee Club <news@beans.example>", "Bike Share <ride@citybike.example>"]), rng.pick(["Weekend sale", "Your monthly summary", "New in store", "We miss you"]), "Promotional email. Nothing important.");
  }
  return m.sort((a, b) => a.day - b.day);
}

export function generateCalendar(): CalendarEvent[] {
  seq = 0;
  const ev: CalendarEvent[] = [];
  const push = (title: string, day: number, start: string, end: string, location?: string, attendees: string[] = []): void => {
    const e: CalendarEvent = { _id: id("cal"), title, day, start, end, attendees };
    if (location) e.location = location;
    ev.push(e);
  };
  push("First day at Studio Kite", 2, "9:00 AM", "6:00 PM", "Union Square office");
  for (const d of FACTS.designReviewDays) push("Design review", d, FACTS.designReviewTime, "3:00 PM", "Fern room", [FACTS.managerName]);
  for (const d of FACTS.gymDays) push("Gym", d, FACTS.gymTime, "8:00 AM", FACTS.gymName);
  push("Priya's birthday dinner", FACTS.friendDinnerDay, FACTS.friendDinnerTime, "10:00 PM", FACTS.friendDinnerPlace, [FACTS.friend]);
  push("1:1 with Sam", FACTS.oneOnOneDay, FACTS.oneOnOneTime, "11:30 AM", "Fern room", [FACTS.managerName]);
  push("Dentist", FACTS.dentistDay, FACTS.dentistTime, "10:15 AM", "Bright Smile Dental");
  push("Apartment viewings", 3, "5:30 PM", "7:30 PM", "Bushwick");
  push("Apartment viewings", 6, "5:30 PM", "7:30 PM", "Williamsburg");
  push("Lease signing", 30, "10:00 AM", "11:00 AM", "Keystone Leasing", [FACTS.leaseBroker]);
  push("Flight to Chicago", FACTS.flightHomeDay, FACTS.flightHomeTime, "9:00 PM", "LGA");
  return ev.sort((a, b) => a.day - b.day);
}
