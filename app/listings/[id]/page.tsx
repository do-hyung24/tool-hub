import { notFound } from "next/navigation";
import { getListingById, getSellerById } from "@/lib/data";
import { formatDate, formatPrice } from "@/lib/format";
import { ScanBadge } from "@/app/_components/ScanBadge";

export default async function ListingDetailPage(
  props: PageProps<"/listings/[id]">
) {
  const { id } = await props.params;
  const listing = await getListingById(id);

  if (!listing) {
    notFound();
  }

  const seller = await getSellerById(listing.sellerId);

  return (
    <main className="mx-auto w-full max-w-3xl flex-1 px-6 py-10">
      <div className="flex items-start justify-between gap-2">
        <span className="rounded-full bg-zinc-100 px-2.5 py-1 text-xs font-medium text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300">
          {listing.category}
        </span>
        <ScanBadge scanResult={listing.scanResult} />
      </div>

      <h1 className="mt-4 text-2xl font-bold">{listing.title}</h1>
      <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
        등록일 {formatDate(listing.createdAt)}
      </p>

      <p className="mt-6 text-2xl font-semibold">{formatPrice(listing.price)}</p>

      <section className="mt-8">
        <h2 className="text-sm font-semibold text-zinc-500 dark:text-zinc-400">
          설명
        </h2>
        <p className="mt-2 whitespace-pre-wrap text-zinc-800 dark:text-zinc-200">
          {listing.description}
        </p>
      </section>

      <section className="mt-8">
        <h2 className="text-sm font-semibold text-zinc-500 dark:text-zinc-400">
          코드 링크
        </h2>
        <a
          href={listing.codeUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-2 inline-block break-all text-sm font-medium text-blue-600 underline underline-offset-2 dark:text-blue-400"
        >
          {listing.codeUrl}
        </a>
      </section>

      <section className="mt-8 rounded-xl border border-zinc-200 p-4 dark:border-zinc-800">
        <h2 className="text-sm font-semibold text-zinc-500 dark:text-zinc-400">
          보안 스캔 결과
        </h2>

        {!listing.scanResult ? (
          <p className="mt-2 text-sm text-zinc-500 dark:text-zinc-400">
            AI가 코드를 검토하고 있습니다. 잠시 후 새로고침하면 결과가
            반영됩니다.
          </p>
        ) : (
          <>
            <ul className="mt-2 space-y-1 text-sm text-zinc-700 dark:text-zinc-300">
              <li>
                하드코딩된 시크릿:{" "}
                {listing.scanResult.hasHardcodedSecret ? "발견됨" : "없음"}
              </li>
              <li>
                취약한 의존성:{" "}
                {listing.scanResult.hasVulnerableDependency ? "발견됨" : "없음"}
              </li>
              <li>스캔 일시: {formatDate(listing.scanResult.scannedAt)}</li>
            </ul>

            {!listing.scanResult.passed && (
              <div className="mt-4 space-y-3">
                {listing.scanResult.findings.length > 0 && (
                  <div>
                    <h3 className="text-xs font-semibold text-amber-700 dark:text-amber-400">
                      발견된 문제점
                    </h3>
                    <ul className="mt-1 list-inside list-disc space-y-1 text-sm text-zinc-700 dark:text-zinc-300">
                      {listing.scanResult.findings.map((finding, index) => (
                        <li key={index}>{finding}</li>
                      ))}
                    </ul>
                  </div>
                )}
                {listing.scanResult.suggestions.length > 0 && (
                  <div>
                    <h3 className="text-xs font-semibold text-zinc-500 dark:text-zinc-400">
                      보완 제안
                    </h3>
                    <ul className="mt-1 list-inside list-disc space-y-1 text-sm text-zinc-700 dark:text-zinc-300">
                      {listing.scanResult.suggestions.map((suggestion, index) => (
                        <li key={index}>{suggestion}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            )}
          </>
        )}
      </section>

      <section className="mt-8 rounded-xl border border-zinc-200 p-4 dark:border-zinc-800">
        <h2 className="text-sm font-semibold text-zinc-500 dark:text-zinc-400">
          판매자 연락처
        </h2>
        {seller ? (
          <div className="mt-2 text-sm text-zinc-700 dark:text-zinc-300">
            <p className="font-medium text-zinc-900 dark:text-zinc-50">
              {seller.nickname}
            </p>
            <p className="mt-1">{seller.contact}</p>
          </div>
        ) : (
          <p className="mt-2 text-sm text-zinc-500 dark:text-zinc-400">
            판매자 정보를 찾을 수 없습니다.
          </p>
        )}
        <p className="mt-3 text-xs text-zinc-400 dark:text-zinc-500">
          결제와 거래는 판매자와 직접 진행해주세요. 툴허브는 연결만 제공합니다.
        </p>
      </section>
    </main>
  );
}
