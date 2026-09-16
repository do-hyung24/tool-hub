import { notFound } from "next/navigation";
import {
  countPurchasesForListing,
  getListingById,
  getPublicScanSummary,
  getSellerById,
  isDeliveryDraftListing,
} from "@/lib/data";
import { getCurrentSellerId } from "@/lib/session";
import { formatDate, formatPrice } from "@/lib/format";
import { ScanSummaryCard } from "@/app/_components/ScanSummaryCard";
import { createPurchaseAction } from "@/app/purchaseActions";
import type { Seller } from "@/lib/types";
import { DeleteListingButton } from "./DeleteListingButton";

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
  const viewerSellerId = await getCurrentSellerId();
  const isOwnListing = viewerSellerId === listing.sellerId;

  // published=true인 매물만 이 페이지에 도달하므로(getListingById가 이미
  // 필터함) 납품용 draft는 사실상 여기 뜰 수 없지만(publishListing이 draft를
  // 절대 게시하지 않음), 판정 자체는 서버 액션과 동일한 조건으로 한 번 더
  // 확인해 UI도 어긋나지 않게 한다.
  const [purchaseCount, isDraft] = isOwnListing
    ? await Promise.all([countPurchasesForListing(listing.id), isDeliveryDraftListing(listing.id)])
    : [0, false];
  const canDelete = isOwnListing && purchaseCount === 0 && !isDraft;

  return (
    <main className="mx-auto w-full max-w-3xl flex-1 px-6 py-10">
      <span className="rounded-full bg-zinc-100 px-2.5 py-1 text-xs font-medium text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300">
        {listing.category}
      </span>

      <div className="mt-4 flex items-start justify-between gap-4">
        <h1 className="text-2xl font-bold">{listing.title}</h1>
        {canDelete && (
          <div className="shrink-0">
            <DeleteListingButton listingId={listing.id} />
          </div>
        )}
      </div>
      <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
        등록일 {formatDate(listing.createdAt)}
      </p>

      <p className="mt-6 text-2xl font-semibold">
        {listing.price === 0 ? (
          <span className="text-emerald-600 dark:text-emerald-400">무료</span>
        ) : (
          formatPrice(listing.price)
        )}
      </p>

      {listing.price > 0 && !isOwnListing && (
        <div className="mt-4">
          <form action={createPurchaseAction}>
            <input type="hidden" name="listingId" value={listing.id} />
            <button
              type="submit"
              className="w-fit rounded-full bg-zinc-900 px-5 py-2.5 text-sm font-medium text-white transition-colors hover:bg-zinc-700 dark:bg-zinc-50 dark:text-zinc-900 dark:hover:bg-zinc-200"
            >
              구매하기
            </button>
          </form>
          <p className="mt-2 text-xs text-zinc-500 dark:text-zinc-400">
            툴허브는 대금을 보관하지 않는 직거래이며, 다운로드 후에는 환불이 어렵습니다.
          </p>
        </div>
      )}

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
        ) : listing.price > 0 ? (
          <p className="mt-2 text-sm text-zinc-500 dark:text-zinc-400">
            zip 업로드로 등록된 유료 매물이라 공개 코드 링크가 없습니다. 구매 후 결제가
            확인되면 파일로 전달됩니다.
          </p>
        ) : (
          <p className="mt-2 text-sm text-zinc-500 dark:text-zinc-400">
            zip 업로드로 등록된 매물이라 공개 코드 링크가 없습니다. 판매자에게
            직접 문의해주세요.
          </p>
        )}
      </section>

      <ScanSummaryCard
        className="mt-8"
        groups={scanSummary}
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
