/** Canned landlord replies, deterministic by listing id so demo runs are repeatable. */
const TEMPLATES = [
  (name: string) =>
    `Hi Maya, thanks for reaching out about ${name}. Yes, the laundry is in the building, right off the lobby. Happy to set up a viewing this week.`,
  (name: string) =>
    `Hello! ${name} is still available. Move-in on the 1st works fine. When would you like to come see it?`,
  (name: string) =>
    `Thanks for your interest in ${name}. I can do a viewing Thursday or Saturday morning. Let me know what suits you.`,
  (name: string) =>
    `Hi Maya, glad you like ${name}. The unit was repainted last month. Laundry is in-unit. Want to see it tomorrow evening?`,
  (name: string) =>
    `Hey, ${name} gets great light in the afternoon. I have a few people interested, so an early viewing would help. Thursday at 6?`,
] as const;

export function hash32(s: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h >>> 0;
}

export function landlordReply(listingId: string, listingTitle: string): string {
  const t = TEMPLATES[hash32(listingId) % TEMPLATES.length]!;
  return t(listingTitle);
}
