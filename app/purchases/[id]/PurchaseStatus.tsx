import type { PurchaseWithDetails, SellerSettlementAccount } from "@/lib/types";
import {
  confirmPurchasePaymentAction,
  markPurchaseTransferSentAction,
} from "@/app/purchaseActions";

type Stage = "pending" | "awaiting_confirm" | "done";

function getStage(purchase: PurchaseWithDetails): Stage {
  if (purchase.paymentConfirmedAt) return "done";
  if (purchase.transferMarkedAt) return "awaiting_confirm";
  return "pending";
}

const STAGE_LABEL: Record<Stage, string> = {
  pending: "결제대기",
  awaiting_confirm: "입금확인대기",
  done: "완료",
};

// app/requests/[requestId]/ConfirmDeliveryButton.tsx의 DirectDealNotice와 같은
// 취지의 문구 - 단정적 보증 표현 없이 사실만 적는다.
function DirectDealNotice() {
  return (
    <div className="mt-4 rounded-lg border border-amber-300 bg-amber-50 p-3 text-xs leading-relaxed text-amber-900 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-200">
      <p>툴허브는 대금을 보관하지 않는 직거래입니다.</p>
      <p className="mt-1">다운로드 후에는 환불이 어려우니, 결제 전 매물 설명을 충분히 확인하세요.</p>
    </div>
  );
}

export function PurchaseStatus({
  purchase,
  isBuyer,
  isSeller,
  settlementAccount,
}: {
  purchase: PurchaseWithDetails;
  isBuyer: boolean;
  isSeller: boolean;
  settlementAccount: SellerSettlementAccount | null;
}) {
  const stage = getStage(purchase);

  return (
    <section className="mt-8">
      <div className="flex items-center gap-2">
        <span className="rounded-full bg-zinc-100 px-2.5 py-1 text-xs font-medium text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300">
          {STAGE_LABEL[stage]}
        </span>
      </div>

      {/* 결제대기: 구매자에게 판매자 계좌 공개 + 이체 완료 표시 */}
      {stage === "pending" &&
        (isBuyer ? (
          <div className="mt-4 flex flex-col gap-3">
            <div className="rounded-lg border border-zinc-200 p-4 text-sm dark:border-zinc-800">
              <h3 className="text-sm font-semibold text-zinc-500 dark:text-zinc-400">
                판매자 계좌
              </h3>
              {settlementAccount?.bankName &&
              settlementAccount.accountHolder &&
              settlementAccount.accountNumber ? (
                <dl className="mt-2 flex flex-col gap-1 text-zinc-700 dark:text-zinc-300">
                  <div className="flex gap-2">
                    <dt className="w-16 shrink-0 text-zinc-400 dark:text-zinc-500">은행</dt>
                    <dd>{settlementAccount.bankName}</dd>
                  </div>
                  <div className="flex gap-2">
                    <dt className="w-16 shrink-0 text-zinc-400 dark:text-zinc-500">예금주</dt>
                    <dd>{settlementAccount.accountHolder}</dd>
                  </div>
                  <div className="flex gap-2">
                    <dt className="w-16 shrink-0 text-zinc-400 dark:text-zinc-500">계좌번호</dt>
                    <dd className="font-mono">{settlementAccount.accountNumber}</dd>
                  </div>
                </dl>
              ) : (
                <p className="mt-2 text-zinc-500 dark:text-zinc-400">
                  판매자 계좌 정보를 불러올 수 없습니다.
                </p>
              )}
            </div>

            <DirectDealNotice />

            <form action={markPurchaseTransferSentAction} className="mt-1">
              <input type="hidden" name="purchaseId" value={purchase.id} />
              <button
                type="submit"
                className="w-fit rounded-full bg-zinc-900 px-5 py-2.5 text-sm font-medium text-white transition-colors hover:bg-zinc-700 dark:bg-zinc-50 dark:text-zinc-900 dark:hover:bg-zinc-200"
              >
                이체 완료 표시하기
              </button>
            </form>
          </div>
        ) : (
          isSeller && (
            <p className="mt-4 text-sm text-zinc-500 dark:text-zinc-400">
              구매자의 이체를 기다리는 중입니다.
            </p>
          )
        ))}

      {/* 입금확인대기: 판매자에게 입금 확인 버튼 */}
      {stage === "awaiting_confirm" &&
        (isSeller ? (
          <form action={confirmPurchasePaymentAction} className="mt-4 flex flex-col gap-3">
            <input type="hidden" name="purchaseId" value={purchase.id} />
            <p className="text-xs text-zinc-500 dark:text-zinc-400">
              구매자가 이체 완료를 표시했습니다. 계좌 입금을 확인한 뒤에만 눌러주세요 - 입금을
              확인하면 구매자의 다운로드가 열립니다.
            </p>
            <button
              type="submit"
              className="w-fit rounded-full bg-zinc-900 px-5 py-2.5 text-sm font-medium text-white transition-colors hover:bg-zinc-700 dark:bg-zinc-50 dark:text-zinc-900 dark:hover:bg-zinc-200"
            >
              입금 확인하기
            </button>
          </form>
        ) : (
          isBuyer && (
            <p className="mt-4 text-sm text-zinc-500 dark:text-zinc-400">
              이체 완료를 표시했습니다. 판매자의 입금 확인을 기다리는 중입니다. 입금이 확인되면
              다운로드가 열립니다.
            </p>
          )
        ))}

      {/* 완료: 구매자에게 다운로드 */}
      {stage === "done" && (
        <div className="mt-4">
          {isBuyer && (
            <div>
              <a
                href={`/api/purchases/${purchase.id}/download`}
                className="inline-block rounded-full bg-zinc-900 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-zinc-700 dark:bg-zinc-50 dark:text-zinc-900 dark:hover:bg-zinc-200"
              >
                완성본 다운로드
              </a>
              <p className="mt-2 text-xs text-zinc-500 dark:text-zinc-400">
                스캔받은 파일과 동일한 완성본입니다.
              </p>
            </div>
          )}
          {isSeller && (
            <p className="text-sm text-zinc-500 dark:text-zinc-400">거래가 완료되었습니다.</p>
          )}
        </div>
      )}
    </section>
  );
}
