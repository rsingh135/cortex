import { describe, expect, it } from "vitest";
import { appFor, listingAttrsFrom, metaFor } from "../play-maya";

describe("play-maya helpers", () => {
  it("maps urls to apps", () => {
    expect(appFor("http://localhost:3000/listings/listing:101")).toBe("mockloft");
    expect(appFor("http://localhost:3000/inbox/priya")).toBe("inbox");
    expect(appFor("http://localhost:3000/calendar")).toBe("calendar");
  });

  it("parses listing attributes from data-* and derives walkup_floor", () => {
    const attrs = listingAttrsFrom({ listingId: "listing:104", price: "2750", neighborhood: "Bushwick", train: "L", floor: "5", elevator: "false", laundry: "true", pets: "false" });
    expect(attrs?.listing_id).toBe("listing:104");
    expect(attrs?.attrs).toMatchObject({ price: 2750, floor: 5, elevator: false, walkup_floor: 5 });
    expect(listingAttrsFrom({ app: "inbox" })).toBeUndefined();
  });

  it("builds a valid IngestCaptureMeta and truncates page text", () => {
    const meta = metaFor(
      { day: 2, app: "landlord_chat", episode: "hunt1-day2", action: "message", target: "listing:101", pause_s: 1 },
      { url: "http://localhost:3000/listings/listing:101", title: "Sunny 1BR", text: "x".repeat(10_000), data: { listingId: "listing:101", price: "2600", floor: "2", elevator: "false" } },
      { type: "submit", text: "Send message", bbox: [1, 2, 3, 4] },
    );
    expect(meta.app).toBe("landlord_chat");
    expect(meta.action.type).toBe("submit");
    expect(meta.page_text?.length).toBe(4000);
    expect(meta.listing?.attrs.walkup_floor).toBe(2);
  });
});
