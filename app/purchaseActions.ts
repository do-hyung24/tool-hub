"use server";

import { notFound, redirect } from "next/navigation";
import { confirmPurchasePayment, createOrGetPurchase, markPurchaseTransferSent } from "@/lib/data";
import { getCurrentSellerId } from "@/lib/session";

// app/requestActions.ts의 동일 헬퍼와 같은 이유 - redirect()는 try/catch 밖,
// 각 액션의 맨 앞에서 로그인 확인을 먼저 끝낸다.
async function requireCurrentSellerId(nextPath: string): Promise<string> {
  const sellerId = await getCurrentSellerId();
  if (!sellerId) {
    redirect(`/login?next=${encodeURIComponent(nextPath)}`);
  }
  return sellerId;
}

// "구매하기" - 본인 매물/무료 매물/미게시 매물이면 구매할 수 없고, 이미 진행
// 중인 구매가 있으면 새로 만들지 않고 그 건으로 보낸다. 권한/상태 문제는
// UI 가드와 별개로 서버 액션이 직접 POST될 수 있으므로 여기서 다시 막는다 -
// 기존 패턴대로 notFound()(404)로 응답하고 throw하지 않는다.
export async function createPurchaseAction(formData: FormData) {
  const listingId = String(formData.get("listingId") ?? "");
  const sellerId = await requireCurrentSellerId(`/listings/${listingId}`);

  const result = await createOrGetPurchase(listingId, sellerId);
  if ("error" in result) {
    notFound();
  }
  redirect(`/purchases/${result.purchaseId}`);
}

// 구매자가 "이체 완료"를 표시한다.
export async function markPurchaseTransferSentAction(formData: FormData) {
  const purchaseId = String(formData.get("purchaseId") ?? "");
  const sellerId = await requireCurrentSellerId(`/purchases/${purchaseId}`);

  const marked = await markPurchaseTransferSent(purchaseId, sellerId);
  if (!marked) {
    notFound();
  }
  redirect(`/purchases/${purchaseId}`);
}

// 판매자가 "입금 확인"을 표시한다.
export async function confirmPurchasePaymentAction(formData: FormData) {
  const purchaseId = String(formData.get("purchaseId") ?? "");
  const sellerId = await requireCurrentSellerId(`/purchases/${purchaseId}`);

  const confirmed = await confirmPurchasePayment(purchaseId, sellerId);
  if (!confirmed) {
    notFound();
  }
  redirect(`/purchases/${purchaseId}`);
}
