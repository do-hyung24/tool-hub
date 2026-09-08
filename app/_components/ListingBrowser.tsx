"use client";

import { useMemo, useState } from "react";
import type { Listing } from "@/lib/types";
import { ListingCard } from "./ListingCard";

// categories는 호출부(app/page.tsx)에서 실제 등록된 매물의 category 값만 뽑아
// 넘겨준다 - 하드코딩된 카테고리 목록이 아니라 그 순간 DB에 존재하는 값 기준이다.
export function ListingBrowser({
  listings,
  categories,
}: {
  listings: Listing[];
  categories: string[];
}) {
  const [selected, setSelected] = useState<string | null>(null);

  const visible = useMemo(
    () => (selected ? listings.filter((listing) => listing.category === selected) : listings),
    [listings, selected]
  );

  if (listings.length === 0) {
    return (
      <p className="text-sm text-zinc-500 dark:text-zinc-400">아직 등록된 매물이 없습니다.</p>
    );
  }

  return (
    <div>
      {categories.length > 1 && (
        <div className="mb-6 flex flex-wrap gap-2">
          <FilterPill label="전체" active={selected === null} onClick={() => setSelected(null)} />
          {categories.map((category) => (
            <FilterPill
              key={category}
              label={category}
              active={selected === category}
              onClick={() => setSelected(category)}
            />
          ))}
        </div>
      )}

      {visible.length === 0 ? (
        <p className="text-sm text-zinc-500 dark:text-zinc-400">
          이 카테고리에는 아직 등록된 매물이 없습니다.
        </p>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {visible.map((listing) => (
            <ListingCard key={listing.id} listing={listing} />
          ))}
        </div>
      )}
    </div>
  );
}

function FilterPill({
  label,
  active,
  onClick,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={`rounded-full px-3 py-1.5 text-sm font-medium transition-colors ${
        active
          ? "bg-zinc-900 text-white dark:bg-zinc-50 dark:text-zinc-900"
          : "border border-zinc-200 text-zinc-600 hover:border-zinc-400 dark:border-zinc-800 dark:text-zinc-300 dark:hover:border-zinc-600"
      }`}
    >
      {label}
    </button>
  );
}
