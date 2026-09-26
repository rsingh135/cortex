import type { Metadata } from "next";
import Link from "next/link";
import { inboxMessages } from "@/lib/data";
import { groupThreads } from "@/lib/threads";
import { currentDay, displayName } from "@/lib/day";
import { landlordThreads } from "@/lib/world-store";

export const metadata: Metadata = { title: "Inbox" };
export const dynamic = "force-dynamic";

export default async function InboxPage() {
  const day = await currentDay();
  const threads = groupThreads([...inboxMessages(), ...landlordThreads()].filter((m) => m.day <= day));
  return (
    <main id="app-root" data-app="inbox" data-page-title="Inbox" data-day={day} className="flex flex-col gap-4">
      <div className="flex items-baseline justify-between">
        <h1 className="text-2xl font-semibold">Inbox</h1>
        <span className="text-xs text-stone-500">day {day}</span>
      </div>
      {threads.length === 0 ? (
        <p className="rounded-lg border border-dashed border-stone-300 p-8 text-center text-stone-500">No messages yet.</p>
      ) : (
        <ul className="divide-y divide-stone-200 rounded-lg border border-stone-300 bg-white">
          {threads.map((t) => (
            <li key={t.id}>
              <Link href={`/inbox/${encodeURIComponent(t.id)}`} data-thread-id={t.id} className="flex items-baseline gap-4 px-4 py-3 hover:bg-stone-50">
                <span className="w-32 flex-none truncate text-sm font-medium">{t.participants.map(displayName).join(", ") || "Maya"}</span>
                <span className="flex-1 truncate text-sm">
                  <span className="font-medium">{t.subject}</span> <span className="text-stone-500">— {t.preview}</span>
                </span>
                <span className="flex-none text-xs text-stone-500">
                  day {t.lastDay} · {t.count}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
