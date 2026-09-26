import type { Message } from "@cortex/schema";

export interface Thread {
  id: string;
  kind: Message["kind"];
  subject: string;
  participants: string[];
  lastDay: number;
  count: number;
  preview: string;
}

/** Group messages into threads, newest simulated day first. */
export function groupThreads(messages: readonly Message[]): Thread[] {
  const byId = new Map<string, Message[]>();
  for (const m of messages) {
    const list = byId.get(m.thread_id) ?? [];
    list.push(m);
    byId.set(m.thread_id, list);
  }
  const threads: Thread[] = [];
  for (const [id, list] of byId) {
    const sorted = [...list].sort((a, b) => a.day - b.day);
    const last = sorted[sorted.length - 1]!;
    const participants = [...new Set(sorted.flatMap((m) => [m.from, m.to]))].filter((p) => p !== "Maya");
    threads.push({
      id,
      kind: last.kind,
      subject: sorted.find((m) => m.subject)?.subject ?? (last.kind === "landlord_chat" ? `Landlord chat · ${last.listing_id ?? ""}` : "(no subject)"),
      participants,
      lastDay: last.day,
      count: sorted.length,
      preview: last.body.slice(0, 120),
    });
  }
  return threads.sort((a, b) => b.lastDay - a.lastDay || a.id.localeCompare(b.id));
}
