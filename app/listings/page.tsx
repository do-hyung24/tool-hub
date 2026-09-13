import Link from "next/link";
import { getListings } from "@/lib/data";
import { getCurrentSellerId } from "@/lib/session";
import { ListingBrowser } from "../_components/ListingBrowser";

// 매물 목록은 DB에서 실시간으로 바뀌므로 빌드 타임에 정적으로 굳히지 않는다.
export const dynamic = "force-dynamic";

export default async function ListingsPage() {
  const [listings, sellerId] = await Promise.all([getListings(), getCurrentSellerId()]);

  // 실제 등록된 매물에 존재하는 카테고리만 필터 옵션으로 노출한다 (하드코딩 금지).
  const categories = Array.from(new Set(listings.map((listing) => listing.category))).sort();
  const registerHref = sellerId ? "/listings/new" : "/login?next=/listings/new";

  return (
    <main className="mx-auto w-full max-w-3xl flex-1 px-6 py-10">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">마켓</h1>
          <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
            자동 보안 스캔을 마친 개인 제작 자동화 툴
          </p>
        </div>
        <Link
          href={registerHref}
          className="rounded-full bg-zinc-900 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-zinc-700 dark:bg-zinc-50 dark:text-zinc-900 dark:hover:bg-zinc-200"
        >
          내 툴 등록하기
        </Link>
      </div>

      <div className="mt-8">
        <ListingBrowser listings={listings} categories={categories} />
      </div>
    </main>
  );
}
