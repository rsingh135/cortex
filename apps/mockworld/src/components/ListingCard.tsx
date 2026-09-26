import Link from "next/link";
import type { Listing } from "@cortex/schema";
import { placeholderPhoto } from "@/lib/photo";

export function ListingCard({ listing }: { listing: Listing }) {
  const l = listing;
  return (
    <Link
      href={`/listings/${encodeURIComponent(l._id)}`}
      data-listing-id={l._id}
      className="flex gap-4 rounded-lg border border-stone-300 bg-white p-3 hover:border-stone-500"
    >
      {/* eslint-disable-next-line @next/next/no-img-element -- inline SVG data URL, no optimization needed */}
      <img src={l.photos[0] ?? placeholderPhoto(l._id)} alt="" width={160} height={105} className="h-[105px] w-[160px] rounded object-cover" />
      <div className="flex flex-1 flex-col gap-1">
        <div className="flex items-baseline justify-between gap-3">
          <h2 className="text-lg font-semibold">{l.title}</h2>
          <span className="text-lg font-semibold">${l.price.toLocaleString()}/mo</span>
        </div>
        <p className="text-sm text-stone-600">
          {l.neighborhood} · {l.train} train · floor {l.floor}
          {l.elevator ? ", elevator" : ", walk-up"}
        </p>
        <p className="text-sm text-stone-700">
          {l.laundry ? "Laundry" : "No laundry"} · {l.pets ? "Pets OK" : "No pets"}
        </p>
      </div>
    </Link>
  );
}
