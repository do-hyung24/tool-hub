import { getListings } from "@/lib/data";
import { ListingCard } from "./_components/ListingCard";

// 매물 목록은 DB에서 실시간으로 바뀌므로 빌드 타임에 정적으로 굳히지 않는다.
export const dynamic = "force-dynamic";

export default async function Home() {
  const listings = await getListings();

  return (
    <main className="mx-auto w-full max-w-5xl flex-1 px-6 py-10">
      <section className="mb-12 border-b border-zinc-100 pb-10 dark:border-zinc-900">
        <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-3 py-1 text-xs font-medium text-emerald-700 dark:bg-emerald-950 dark:text-emerald-400">
          🔍 등록 즉시 자동 보안 스캔
        </span>
        <h1 className="mt-4 max-w-2xl text-3xl font-bold tracking-tight text-zinc-900 sm:text-4xl dark:text-zinc-50">
          AI가 자동으로 보안 스캔하는 바이브코딩 봇 거래 허브
        </h1>
        <p className="mt-3 max-w-xl text-base text-zinc-600 dark:text-zinc-400">
          직접 만든 자동화 봇/스크립트를 등록하면 하드코딩된 시크릿, 위험한
          코드 실행 같은 문제를 자동으로 찾아 구매자에게 투명하게 보여드립니다.
        </p>
        <p className="mt-5 text-sm font-medium text-zinc-500 dark:text-zinc-500">
          수수료 없는 개인 간 직거래 &middot; 판매자와 바로 연결
        </p>
      </section>

      <div className="mb-8">
        <h2 className="text-xl font-bold">지금 등록된 매물</h2>
      </div>

      {listings.length === 0 ? (
        <p className="text-sm text-zinc-500 dark:text-zinc-400">
          아직 등록된 매물이 없습니다.
        </p>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {listings.map((listing) => (
            <ListingCard key={listing.id} listing={listing} />
          ))}
        </div>
      )}
    </main>
  );
}
