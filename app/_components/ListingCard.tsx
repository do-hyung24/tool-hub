import Link from "next/link";
import type { Listing } from "@/lib/types";
import { formatPrice } from "@/lib/format";

export function ListingCard({ listing }: { listing: Listing }) {
  return (
    <Link
      href={`/listings/${listing.id}`}
      className="flex flex-col gap-3 rounded-xl border border-zinc-200 p-5 transition-colors hover:border-zinc-400 dark:border-zinc-800 dark:hover:border-zinc-600"
    >
      <div className="flex items-center justify-between gap-2">
        <span className="rounded-full bg-zinc-100 px-2.5 py-1 text-xs font-medium text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300">
          {listing.category}
        </span>
        {listing.scanStatus === "completed" && (
          <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-emerald-50 px-2 py-1 text-xs font-medium text-emerald-700 dark:bg-emerald-950 dark:text-emerald-400">
            🔍 스캔 완료
          </span>
        )}
      </div>
      <div>
        <h3 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">
          {listing.title}
        </h3>
        <p className="mt-1 line-clamp-2 text-sm text-zinc-500 dark:text-zinc-400">
          {listing.description}
        </p>
      </div>
      <p className="mt-auto border-t border-zinc-100 pt-3 text-base font-semibold text-zinc-900 dark:border-zinc-800 dark:text-zinc-50">
        {formatPrice(listing.price)}
      </p>
    </Link>
  );
}
