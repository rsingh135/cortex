"use client";

import { useState } from "react";
import { WRITE_TOKEN_HEADER } from "@cortex/schema";

type Status = "idle" | "busy" | "rejected" | "sent" | "error";

/** Reject button and landlord message form. Posts to the write endpoints with the dev token. */
export function ListingActions({ listingId }: { listingId: string }) {
  const [status, setStatus] = useState<Status>("idle");
  const [body, setBody] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [reply, setReply] = useState<string | null>(null);

  const headers = {
    "content-type": "application/json",
    [WRITE_TOKEN_HEADER]: process.env.NEXT_PUBLIC_CORTEX_WRITE_TOKEN ?? "",
  };

  async function reject() {
    setStatus("busy");
    setError(null);
    const res = await fetch("/api/reject", { method: "POST", headers, body: JSON.stringify({ listing_id: listingId }) });
    if (res.ok) setStatus("rejected");
    else {
      setStatus("error");
      setError(`Reject failed (${res.status})`);
    }
  }

  async function send(e: React.FormEvent) {
    e.preventDefault();
    if (!body.trim()) return;
    setStatus("busy");
    setError(null);
    const res = await fetch("/api/messages", { method: "POST", headers, body: JSON.stringify({ listing_id: listingId, body }) });
    if (res.ok) {
      const data = (await res.json()) as { reply?: { body?: string } };
      setReply(data.reply?.body ?? null);
      setStatus("sent");
    } else {
      setStatus("error");
      setError(`Send failed (${res.status})`);
    }
  }

  return (
    <section aria-label="Actions" className="flex flex-col gap-4" data-status={status}>
      <div>
        <button
          id="reject"
          type="button"
          onClick={reject}
          disabled={status === "busy" || status === "rejected"}
          className="rounded border border-stone-400 bg-white px-4 py-2 text-base font-medium hover:bg-stone-100 disabled:opacity-50"
        >
          Reject
        </button>
        {status === "rejected" && <span className="ml-3 text-sm text-stone-600">Rejected. This listing is off your list.</span>}
      </div>

      <form id="message-form" onSubmit={send} className="flex flex-col gap-2 rounded-lg border border-stone-300 bg-white p-4">
        <label htmlFor="message-body" className="text-base font-semibold">
          Message landlord
        </label>
        <textarea
          id="message-body"
          name="body"
          value={body}
          onChange={(e) => setBody(e.target.value)}
          rows={4}
          placeholder="Hi, I'm interested in this apartment. Is laundry in the building?"
          className="w-full rounded border border-stone-300 p-2 text-sm"
          disabled={status === "sent"}
        />
        <div className="flex items-center gap-3">
          <button
            type="submit"
            disabled={status === "busy" || status === "sent" || body.trim() === ""}
            className="rounded bg-stone-900 px-4 py-2 text-base font-medium text-white hover:bg-stone-700 disabled:opacity-50"
          >
            Send message
          </button>
          {status === "sent" && <span className="text-sm text-stone-600">Sent. The landlord replied in your inbox.</span>}
        </div>
        {reply && (
          <blockquote className="mt-2 border-l-2 border-stone-300 pl-3 text-sm text-stone-700" data-landlord-reply>
            {reply}
          </blockquote>
        )}
        {error && (
          <p role="alert" className="text-sm text-red-700">
            {error}
          </p>
        )}
      </form>
    </section>
  );
}
