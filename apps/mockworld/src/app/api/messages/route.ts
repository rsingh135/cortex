import { z } from "zod";
import type { Message } from "@cortex/schema";
import { isAuthorized, tokenFromHeaders } from "@/lib/auth";
import { listingById } from "@/lib/data";
import { landlordReply } from "@/lib/replies";
import { addMessage, nextId } from "@/lib/world-store";

const Body = z.object({
  listing_id: z.string().min(1),
  body: z.string().min(1).max(4000),
  /** Simulated day; defaults to 0 when the caller does not track the clock. */
  day: z.number().int().min(0).optional(),
  sent_by: z.enum(["maya", "agent"]).optional(),
});

export async function POST(request: Request) {
  if (!isAuthorized(tokenFromHeaders(request.headers), process.env.CORTEX_WRITE_TOKEN)) {
    return Response.json({ error: "unauthorized" }, { status: 401 });
  }
  const parsed = Body.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: "invalid body" }, { status: 400 });
  const listing = listingById(parsed.data.listing_id);
  if (!listing) return Response.json({ error: "unknown listing" }, { status: 404 });

  const day = parsed.data.day ?? 0;
  const threadId = `landlord:${listing._id}`;
  const outgoing: Message = {
    _id: nextId("msg"),
    thread_id: threadId,
    kind: "landlord_chat",
    listing_id: listing._id,
    from: "Maya",
    to: listing.landlord,
    body: parsed.data.body,
    day,
    sent_by: parsed.data.sent_by ?? "maya",
  };
  const reply: Message = {
    _id: nextId("msg"),
    thread_id: threadId,
    kind: "landlord_chat",
    listing_id: listing._id,
    from: listing.landlord,
    to: "Maya",
    body: landlordReply(listing._id, listing.title),
    day,
    sent_by: "world",
  };
  // TODO(engine): write both documents to the Atlas `messages` collection.
  addMessage(outgoing);
  addMessage(reply);
  return Response.json({ message: outgoing, reply }, { status: 201 });
}
