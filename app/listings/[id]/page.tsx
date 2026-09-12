import { notFound } from "next/navigation";
import { getListingById, getPublicScanSummary, getSellerById } from "@/lib/data";
import { formatDate, formatPrice } from "@/lib/format";
import { ScanSummaryCard } from "@/app/_components/ScanSummaryCard";
import type { Seller } from "@/lib/types";

// contact가 비어 있거나 로그인 이메일과 같은 값이면 로그인 이메일이 그대로
// 노출되는 것이므로 공개하지 않는다. 판매자가 로그인 이메일과 다른 값을
// 직접 남긴 경우에만(예: 계정에 로그인 경로가 없는 시드 판매자) 노출한다.
function getPublicContact(seller: Seller): string | null {
  const contact = seller.contact.trim();
  if (!contact) return null;
  if (seller.email && contact.toLowerCase() === seller.email.trim().toLowerCase()) {
    return null;
  }
  return contact;
}

export default async function ListingDetailPage(
  props: PageProps<"/listings/[id]">
) {
  const { id } = await props.params;
  const listing = await getListingById(id);

  if (!listing) {
    notFound();
  }

  const seller = await getSellerById(listing.sellerId);
  const publicContact = seller ? getPublicContact(seller) : null;
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

      <ScanSummaryCard
        className="mt-8"
        groups={scanSummary ?? []}
        disclosureNote={listing.disclosureNote}
      />

      <section className="mt-8 rounded-xl border border-zinc-200 p-4 dark:border-zinc-800">
        <h2 className="text-sm font-semibold text-zinc-500 dark:text-zinc-400">
          판매자 연락처
        </h2>
        {seller ? (
          <div className="mt-2 text-sm text-zinc-700 dark:text-zinc-300">
            <p className="font-medium text-zinc-900 dark:text-zinc-50">
              {seller.nickname}
            </p>
            <p className="mt-1">
              {publicContact ?? (
                <span className="text-zinc-400 dark:text-zinc-500">연락처 미등록</span>
              )}
            </p>
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
