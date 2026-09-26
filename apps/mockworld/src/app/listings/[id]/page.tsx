import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Facts } from "@/components/Facts";
import { ListingActions } from "@/components/ListingActions";
import { listingById } from "@/lib/data";
import { placeholderPhoto } from "@/lib/photo";

export async function generateMetadata(props: PageProps<"/listings/[id]">): Promise<Metadata> {
  const { id } = await props.params;
  const l = listingById(decodeURIComponent(id));
  return { title: l ? `MockLoft · ${l.title}` : "MockLoft · Listing" };
}

export default async function ListingPage(props: PageProps<"/listings/[id]">) {
  const { id } = await props.params;
  const l = listingById(decodeURIComponent(id));
  if (!l) notFound();

  const photos = l.photos.length ? l.photos : [0, 1, 2].map((i) => placeholderPhoto(l._id, i));

  return (
    <main
      id="app-root"
      data-app="mockloft"
      data-page-title={l.title}
      data-listing-id={l._id}
      data-price={l.price}
      data-neighborhood={l.neighborhood}
      data-train={l.train}
      data-floor={l.floor}
      data-elevator={String(l.elevator)}
      data-laundry={String(l.laundry)}
      data-pets={String(l.pets)}
      data-walkup-floor={l.walkup_floor}
      className="flex flex-col gap-6"
    >
      <Link href="/listings" className="text-sm text-stone-600 hover:underline">
        ← Back to listings
      </Link>

      <header className="flex flex-wrap items-baseline justify-between gap-3">
        <h1 className="text-2xl font-semibold">{l.title}</h1>
        <p className="text-2xl font-semibold">${l.price.toLocaleString()}/mo</p>
      </header>

      <div className="flex gap-3 overflow-x-auto">
        {photos.map((src, i) => (
          // eslint-disable-next-line @next/next/no-img-element -- inline SVG data URL
          <img key={i} src={src} alt="" width={320} height={210} className="h-[210px] w-[320px] flex-none rounded object-cover" />
        ))}
      </div>

      <Facts
        rows={[
          ["Neighborhood", l.neighborhood],
          ["Nearest train", l.train],
          ["Floor", `${l.floor}${l.elevator ? " (elevator)" : " (walk-up)"}`],
          ["Laundry", l.laundry ? "In unit or building" : "None"],
          ["Pets", l.pets ? "Allowed" : "Not allowed"],
          ["Landlord", l.landlord],
        ]}
      />

      <section aria-label="Description" className="rounded-lg border border-stone-300 bg-white p-4">
        <h2 className="mb-2 text-base font-semibold">About this place</h2>
        <p className="whitespace-pre-line text-sm leading-6 text-stone-800">{l.description || "No description provided."}</p>
      </section>

      <ListingActions listingId={l._id} />
    </main>
  );
}
