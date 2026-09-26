import type { Metadata } from "next";
import { HUNTS } from "@cortex/schema";
import { ListingCard } from "@/components/ListingCard";
import { allListings } from "@/lib/data";
import { applyFilter, facets, parseFilter } from "@/lib/filter";

export const metadata: Metadata = { title: "MockLoft · Listings" };

export default async function ListingsPage(props: PageProps<"/listings">) {
  const params = await props.searchParams;
  const filter = parseFilter(params);
  const all = allListings();
  const results = applyFilter(all, filter);
  const { neighborhoods, trains } = facets(all);

  return (
    <main id="app-root" data-app="mockloft" data-page-title="Listings" className="flex flex-col gap-6">
      <h1 className="text-2xl font-semibold">Apartments in Brooklyn and Queens</h1>

      <form method="get" action="/listings" id="filters" className="flex flex-wrap items-end gap-4 rounded-lg border border-stone-300 bg-white p-4">
        <label className="flex flex-col text-sm">
          Max price
          <input name="max_price" type="number" min={0} step={50} defaultValue={filter.max_price ?? ""} className="rounded border border-stone-300 p-1.5" />
        </label>
        <label className="flex flex-col text-sm">
          Neighborhood
          <select name="neighborhood" defaultValue={filter.neighborhood ?? ""} className="rounded border border-stone-300 p-1.5">
            <option value="">Any</option>
            {neighborhoods.map((n) => (
              <option key={n} value={n}>
                {n}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col text-sm">
          Train
          <select name="train" defaultValue={filter.train ?? ""} className="rounded border border-stone-300 p-1.5">
            <option value="">Any</option>
            {trains.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col text-sm">
          Set
          <select name="hunt" defaultValue={filter.hunt ?? ""} className="rounded border border-stone-300 p-1.5">
            <option value="">All</option>
            {HUNTS.map((h) => (
              <option key={h} value={h}>
                {h}
              </option>
            ))}
          </select>
        </label>
        <button type="submit" className="rounded bg-stone-900 px-4 py-2 text-sm font-medium text-white">
          Search
        </button>
      </form>

      <p className="text-sm text-stone-600" data-result-count={results.length}>
        {results.length} of {all.length} listings
      </p>

      {results.length === 0 ? (
        <p className="rounded-lg border border-dashed border-stone-300 p-8 text-center text-stone-500">
          {all.length === 0 ? "No listings loaded yet. Generate the persona dataset to fill MockLoft." : "Nothing matches these filters."}
        </p>
      ) : (
        <ul className="flex flex-col gap-3">
          {results.map((l) => (
            <li key={l._id}>
              <ListingCard listing={l} />
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
