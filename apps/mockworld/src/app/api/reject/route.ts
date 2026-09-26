import { z } from "zod";
import { isAuthorized, tokenFromHeaders } from "@/lib/auth";
import { listingById } from "@/lib/data";
import { addRejection } from "@/lib/world-store";

const Body = z.object({ listing_id: z.string().min(1) });

export async function POST(request: Request) {
  if (!isAuthorized(tokenFromHeaders(request.headers), process.env.CORTEX_WRITE_TOKEN)) {
    return Response.json({ error: "unauthorized" }, { status: 401 });
  }
  const parsed = Body.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: "invalid body" }, { status: 400 });
  if (!listingById(parsed.data.listing_id)) return Response.json({ error: "unknown listing" }, { status: 404 });

  // TODO(engine): also write to Atlas so the rejection is durable and visible to the change stream.
  const rejection = addRejection(parsed.data.listing_id);
  return Response.json({ rejection }, { status: 201 });
}
