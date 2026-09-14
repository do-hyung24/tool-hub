import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getPurchaseForParty, getPurchaseSettlementAccountForViewer } from "@/lib/data";
import { getCurrentSellerId } from "@/lib/session";
import { formatPrice } from "@/lib/format";
import { PurchaseStatus } from "./PurchaseStatus";

export default async function PurchaseDetailPage(props: PageProps<"/purchases/[id]">) {
  const { id } = await props.params;

  const sellerId = await getCurrentSellerId();
  if (!sellerId) {
    redirect(`/login?next=${encodeURIComponent(`/purchases/${id}`)}`);
  }

  // 당사자(구매자/판매자)가 아니면 존재 여부도 감춘다(IDOR 방지).
  const purchase = await getPurchaseForParty(id, sellerId);
  if (!purchase) {
    notFound();
  }

  const isBuyer = purchase.buyerSellerId === sellerId;
  const isSeller = purchase.sellerId === sellerId;

  // 계좌는 구매자 본인일 때만 채워진다(getPurchaseSettlementAccountForViewer가
  // SQL 조건으로 강제) - 판매자/제3자는 항상 null.
  const settlementAccount = isBuyer
    ? await getPurchaseSettlementAccountForViewer(id, sellerId)
    : null;

  return (
    <main className="mx-auto w-full max-w-2xl flex-1 px-6 py-10">
      <Link
        href={`/listings/${purchase.listingId}`}
        className="text-xs font-medium text-accent hover:opacity-80"
      >
        ← 매물로 돌아가기
      </Link>
      <h1 className="mt-2 text-2xl font-bold">{purchase.listingTitle}</h1>
      <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
        {formatPrice(purchase.listingPrice)} ·{" "}
        {isBuyer ? `판매자 ${purchase.sellerNickname}` : `구매자 ${purchase.buyerNickname}`}
      </p>

      <PurchaseStatus
        purchase={purchase}
        isBuyer={isBuyer}
        isSeller={isSeller}
        settlementAccount={settlementAccount}
      />
    </main>
  );
}
