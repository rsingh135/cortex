/** Strict JSON the extraction model must return. An empty list is a valid answer. */
import { z } from "zod";
import { Kind, Predicate, Room } from "@cortex/schema";

export const ExtractedBelief = z.object({
  s: z.string().describe("Subject, canonical: 'maya', 'listing:214', 'person:priya'"),
  p: Predicate,
  o: z.string().describe("Object, canonical id or short literal"),
  text: z.string().describe("One plain sentence stating only what the screen shows"),
  kind: Kind.exclude(["preference", "summary"]),
  room: Room,
});

export const ExtractionOutput = z.object({
  beliefs: z.array(ExtractedBelief),
  /** When the page is a listing, the attributes read off the screen. */
  listing: z
    .object({
      listing_id: z.string(),
      price: z.number().int(),
      neighborhood: z.string(),
      train: z.string(),
      floor: z.number().int(),
      elevator: z.boolean(),
      laundry: z.boolean(),
      pets: z.boolean(),
    })
    .nullable(),
});
export type ExtractionOutput = z.infer<typeof ExtractionOutput>;
