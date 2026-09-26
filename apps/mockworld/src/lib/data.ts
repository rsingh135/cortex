/**
 * Persona data for the mock world. JSON is imported statically so the Next bundle carries it
 * (the persona package's fs-based loaders resolve paths relative to source files, which does
 * not survive bundling). Every read validates against @cortex/schema.
 */
import { z } from "zod";
import { CalendarEvent, Listing, Message } from "@cortex/schema";
import listingsJson from "@cortex/persona/data/listings.json";
import inboxJson from "@cortex/persona/data/inbox.json";
import calendarJson from "@cortex/persona/data/calendar.json";

const listingsCache = z.array(Listing).parse(listingsJson);
const inboxCache = z.array(Message).parse(inboxJson);
const calendarCache = z.array(CalendarEvent).parse(calendarJson);

export function allListings(): Listing[] {
  return listingsCache;
}

export function listingById(id: string): Listing | undefined {
  return listingsCache.find((l) => l._id === id);
}

export function inboxMessages(): Message[] {
  return inboxCache;
}

export function calendarEvents(): CalendarEvent[] {
  return calendarCache;
}
