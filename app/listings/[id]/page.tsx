import { notFound } from "next/navigation";
import { getListingById, getPublicScanSummary, getSellerById } from "@/lib/data";
import { formatDate, formatPrice } from "@/lib/format";
import { SecurityScanSummary } from "./SecurityScanSummary";

export default async function ListingDetailPage(
  props: PageProps<"/listings/[id]">
) {
  const { id } = await props.params;
  const listing = await getListingById(id);

  if (!listing) {
    notFound();
  }

  const seller = await getSellerById(listing.sellerId);
  const scanSummary = await getPublicScanSummary(listing.id);

  return (
    <main className="mx-auto w-full max-w-3xl flex-1 px-6 py-10">
      <span className="rounded-full bg-zinc-100 px-2.5 py-1 text-xs font-medium text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300">
        {listing.category}
      </span>

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
        {listing.codeUrl ? (
          <a
            href={listing.codeUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-2 inline-block break-all text-sm font-medium text-blue-600 underline underline-offset-2 dark:text-blue-400"
          >
            {listing.codeUrl}
          </a>
        ) : (
          <p className="mt-2 text-sm text-zinc-500 dark:text-zinc-400">
            zip 업로드로 등록된 매물이라 공개 코드 링크가 없습니다. 판매자에게
            직접 문의해주세요.
          </p>
        )}
      </section>

      {/* 스캔 결과와 무관하게 모든 매물에 예외 없이 노출되는 중립 고지 문구입니다. */}
      <section className="mt-8 rounded-xl border border-zinc-200 p-4 dark:border-zinc-800">
        <p className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
          🔍 자동 보안 스캔을 거쳤습니다
        </p>
        {scanSummary && scanSummary.length > 0 && <SecurityScanSummary groups={scanSummary} />}
        {listing.disclosureNote && (
          <div className="mt-3 border-t border-zinc-100 pt-3 dark:border-zinc-800">
            <h3 className="text-xs font-semibold text-zinc-500 dark:text-zinc-400">
              판매자 코멘트
            </h3>
            <p className="mt-1 whitespace-pre-wrap text-sm text-zinc-700 dark:text-zinc-300">
              {listing.disclosureNote}
            </p>
          </div>
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
