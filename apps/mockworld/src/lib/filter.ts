import type { Listing } from "@cortex/schema";
import { HUNTS, type Hunt } from "@cortex/schema";

export interface ListingFilter {
  max_price?: number;
  neighborhood?: string;
  train?: string;
  hunt?: Hunt;
}

type SearchParams = Record<string, string | string[] | undefined>;

function first(v: string | string[] | undefined): string | undefined {
  const s = Array.isArray(v) ? v[0] : v;
  return s && s.trim() !== "" ? s.trim() : undefined;
}

/** Parse URL search params into a filter. Unknown or malformed values are ignored. */
export function parseFilter(params: SearchParams): ListingFilter {
  const f: ListingFilter = {};
  const price = first(params.max_price);
  if (price !== undefined) {
    const n = Number(price);
    if (Number.isFinite(n) && n >= 0) f.max_price = Math.floor(n);
  }
  const neighborhood = first(params.neighborhood);
  if (neighborhood) f.neighborhood = neighborhood;
  const train = first(params.train);
  if (train) f.train = train;
  const hunt = first(params.hunt);
  if (hunt && (HUNTS as readonly string[]).includes(hunt)) f.hunt = hunt as Hunt;
  return f;
}

/** Apply a filter. Neighborhood and train match case-insensitively. */
export function applyFilter(listings: readonly Listing[], f: ListingFilter): Listing[] {
  return listings.filter((l) => {
    if (f.max_price !== undefined && l.price > f.max_price) return false;
    if (f.neighborhood && l.neighborhood.toLowerCase() !== f.neighborhood.toLowerCase()) return false;
    if (f.train && l.train.toLowerCase() !== f.train.toLowerCase()) return false;
    if (f.hunt && l.hunt !== f.hunt) return false;
    return true;
  });
}

/** Distinct values for the filter form. */
export function facets(listings: readonly Listing[]): { neighborhoods: string[]; trains: string[] } {
  const neighborhoods = [...new Set(listings.map((l) => l.neighborhood))].sort();
  const trains = [...new Set(listings.map((l) => l.train))].sort();
  return { neighborhoods, trains };
}
