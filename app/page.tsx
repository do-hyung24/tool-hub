import { getListings } from "@/lib/data";
import { ListingCard } from "./_components/ListingCard";

export default async function Home() {
  const listings = await getListings();

  return (
    <main className="mx-auto w-full max-w-5xl flex-1 px-6 py-10">
      <div className="mb-8">
        <h1 className="text-2xl font-bold">자동화 봇 &middot; 스크립트 매물</h1>
        <p className="mt-2 text-sm text-zinc-500 dark:text-zinc-400">
          직접 만든 자동화 봇/스크립트를 구매자와 직접 연결해드립니다. 거래
          수수료는 없습니다.
        </p>
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
