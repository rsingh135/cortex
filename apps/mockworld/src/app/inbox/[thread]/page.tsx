import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { inboxMessages } from "@/lib/data";
import { messagesForThread } from "@/lib/world-store";
import { currentDay, displayName } from "@/lib/day";

export const dynamic = "force-dynamic";

export async function generateMetadata(props: PageProps<"/inbox/[thread]">): Promise<Metadata> {
  const { thread } = await props.params;
  return { title: `Inbox · ${decodeURIComponent(thread)}` };
}

export default async function ThreadPage(props: PageProps<"/inbox/[thread]">) {
  const { thread } = await props.params;
  const id = decodeURIComponent(thread);
  const day = await currentDay();
  const messages = [...inboxMessages().filter((m) => m.thread_id === id), ...messagesForThread(id)].filter((m) => m.day <= day).sort((a, b) => a.day - b.day);
  if (messages.length === 0) notFound();
  const first = messages[0]!;
  const app = first.kind === "landlord_chat" ? "landlord_chat" : "inbox";
  const title = first.subject ?? `Landlord chat · ${first.listing_id ?? ""}`;

  return (
    <main id="app-root" data-app={app} data-page-title={title} data-thread-id={id} className="flex flex-col gap-4">
      <Link href="/inbox" className="text-sm text-stone-600 hover:underline">
        ← Inbox
      </Link>
      <h1 className="text-2xl font-semibold">{title}</h1>
      {first.listing_id && (
        <Link href={`/listings/${encodeURIComponent(first.listing_id)}`} className="text-sm text-stone-600 hover:underline">
          View listing {first.listing_id}
        </Link>
      )}
      <ol className="flex flex-col gap-3">
        {messages.map((m) => (
          <li key={m._id} className={`max-w-[80%] rounded-lg border border-stone-300 p-3 ${m.from === "Maya" ? "self-end bg-stone-100" : "self-start bg-white"}`} data-message-id={m._id}>
            <p className="mb-1 text-xs text-stone-500">
              <span className="font-medium text-stone-700">{displayName(m.from)}</span> → {displayName(m.to)} · day {m.day}
            </p>
            <p className="whitespace-pre-line text-sm leading-6">{m.body}</p>
          </li>
        ))}
      </ol>
    </main>
  );
}
