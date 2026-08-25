import Link from "next/link";
import type { Listing } from "@/lib/types";
import { formatPrice } from "@/lib/format";
import { ScanBadge } from "./ScanBadge";

export function ListingCard({ listing }: { listing: Listing }) {
  return (
    <Link
      href={`/listings/${listing.id}`}
      className="flex flex-col gap-3 rounded-xl border border-zinc-200 p-5 transition-colors hover:border-zinc-400 dark:border-zinc-800 dark:hover:border-zinc-600"
    >
      <div className="flex items-start justify-between gap-2">
        <span className="rounded-full bg-zinc-100 px-2.5 py-1 text-xs font-medium text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300">
          {listing.category}
        </span>
        <ScanBadge scanResult={listing.scanResult} />
      </div>
      <div>
        <h3 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">
          {listing.title}
        </h3>
        <p className="mt-1 line-clamp-2 text-sm text-zinc-500 dark:text-zinc-400">
          {listing.description}
        </p>
      </div>
      <p className="mt-auto text-base font-semibold text-zinc-900 dark:text-zinc-50">
        {formatPrice(listing.price)}
      </p>
    </Link>
  );
}
