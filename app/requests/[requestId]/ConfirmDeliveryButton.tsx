import { ScanSummaryCard } from "@/app/_components/ScanSummaryCard";
import {
  acceptDeliveryAction,
  confirmPaymentAction,
  markTransferSentAction,
} from "@/app/requestActions";
import type { PublicFindingGroup } from "@/lib/findingCategories";
import type {
  Listing,
  SellerSettlementAccount,
  ToolProposal,
  ToolProposalDeliveryProof,
} from "@/lib/types";

// 직거래 결제/정산(에스크로 없음) 단계를 tool_proposals의 타임스탬프로 판정한다.
//   summary 없음                     → 아직 스캔 게이트 전(표시 안 함)
//   buyerAcceptedAt 없음              → A. 의뢰인 수락 대기
//   buyerAcceptedAt만 있음            → B. 계좌 공개 + 이체 대기
//   transferMarkedAt까지 있음         → C. 제작자 입금 확인 대기
//   paymentConfirmedAt까지 있음       → D. 완료(다운로드 가능)
type DeliveryStage = "awaiting_accept" | "awaiting_transfer" | "awaiting_payment_confirm" | "done";

function getDeliveryStage(proposal: ToolProposal): DeliveryStage {
  if (!proposal.buyerAcceptedAt) return "awaiting_accept";
  if (!proposal.transferMarkedAt) return "awaiting_transfer";
  if (!proposal.paymentConfirmedAt) return "awaiting_payment_confirm";
  return "done";
}

function DirectDealNotice() {
  return (
    <div className="mt-4 rounded-lg border border-amber-300 bg-amber-50 p-3 text-xs leading-relaxed text-amber-900 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-200">
      <p>보안 스캔은 안전만 검증하며 업무 적합성·품질을 보증하지 않습니다.</p>
      <p className="mt-1">
        툴허브는 대금을 보관하지 않는 직거래이며, 결제 후 환불·강제는 어렵습니다. 결제 전
        작동 증빙을 충분히 확인하세요.
      </p>
    </div>
  );
}

function DeliveryProofSection({
  requestId,
  proofImages,
  hasVideo,
}: {
  requestId: string;
  proofImages: ToolProposalDeliveryProof[];
  hasVideo: boolean;
}) {
  if (proofImages.length === 0 && !hasVideo) return null;
  return (
    <div className="mt-4">
      <h3 className="text-sm font-semibold text-zinc-500 dark:text-zinc-400">작동 증빙</h3>
      {proofImages.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-2">
          {proofImages.map((proof) => (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              key={proof.id}
              src={`/api/requests/${requestId}/delivery/asset/${proof.id}`}
              alt="작동 증빙 스크린샷"
              className="h-28 w-28 rounded-lg object-cover ring-1 ring-zinc-950/[0.08]"
            />
          ))}
        </div>
      )}
      {hasVideo && (
        <video
          controls
          className="mt-2 w-full max-w-sm rounded-lg"
          src={`/api/requests/${requestId}/delivery/asset/video`}
        />
      )}
    </div>
  );
}

export function ConfirmDeliveryButton({
  requestId,
  summary,
  proofImages,
  settlementAccount,
  isRequester,
  isSelectedSeller,
  alreadyCompleted,
}: {
  requestId: string;
  summary: { proposal: ToolProposal; listing: Listing; findings: PublicFindingGroup[] } | null;
  proofImages: ToolProposalDeliveryProof[];
  settlementAccount: SellerSettlementAccount | null;
  isRequester: boolean;
  isSelectedSeller: boolean;
  alreadyCompleted: boolean;
}) {
  if (!summary) {
    return null;
  }

  const stage = getDeliveryStage(summary.proposal);

  return (
    <section className="mt-10 border-t border-zinc-200 pt-8 dark:border-zinc-800">
      <h2 className="text-sm font-semibold">
        {isRequester ? "완성본 도착" : "완성본 제출 완료"}
      </h2>
      <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
        {isRequester
          ? "선택한 판매자가 완성본을 제출했고 자동 보안 스캔을 마쳤습니다. 이 완성본은 의뢰자에게만 전달되며 공개 마켓에는 올라가지 않습니다."
          : "제출한 완성본이 자동 보안 스캔을 마치고 의뢰자에게 전달되었습니다. 이 완성본은 의뢰자에게만 전달되며 공개 마켓에는 올라가지 않습니다."}
      </p>

      {summary.proposal.deliveryGuide && (
        <div className="mt-4">
          <h3 className="text-sm font-semibold text-zinc-500 dark:text-zinc-400">
            실행 가이드
          </h3>
          <p className="mt-2 whitespace-pre-wrap text-sm text-zinc-700 dark:text-zinc-300">
            {summary.proposal.deliveryGuide}
          </p>
        </div>
      )}

      <DeliveryProofSection
        requestId={requestId}
        proofImages={proofImages}
        hasVideo={!!summary.proposal.deliveryProofVideoUrl}
      />

      <ScanSummaryCard
        className="mt-4"
        groups={summary.findings}
        disclosureNote={summary.listing.disclosureNote}
      />

      {stage === "done" && (
        <div className="mt-4">
          <h3 className="text-sm font-semibold text-zinc-500 dark:text-zinc-400">
            코드 링크
          </h3>
          {summary.listing.codeUrl ? (
            <a
              href={summary.listing.codeUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-2 inline-block break-all text-sm font-medium text-blue-600 underline underline-offset-2 dark:text-blue-400"
            >
              {summary.listing.codeUrl}
            </a>
          ) : (
            <div className="mt-2">
              <a
                href={`/api/requests/${requestId}/delivery/download`}
                className="inline-block rounded-full bg-zinc-900 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-zinc-700 dark:bg-zinc-50 dark:text-zinc-900 dark:hover:bg-zinc-200"
              >
                완성본 다운로드
              </a>
              <p className="mt-2 text-xs text-zinc-500 dark:text-zinc-400">
                스캔받은 파일과 동일한 완성본입니다. 실행 방법은 위 실행 가이드를 참고하세요.
              </p>
            </div>
          )}
        </div>
      )}

      {/* A. 의뢰인 수락 대기 */}
      {stage === "awaiting_accept" &&
        (isRequester ? (
          <form action={acceptDeliveryAction} className="mt-4 flex flex-col gap-3">
            <input type="hidden" name="requestId" value={requestId} />
            <input type="hidden" name="proposalId" value={summary.proposal.id} />
            <p className="text-xs text-zinc-500 dark:text-zinc-400">
              위 실행 가이드와 작동 증빙을 확인하고, 완성본을 수락하면 다음 단계(제작자
              계좌 공개 및 이체)로 진행됩니다.
            </p>
            <button
              type="submit"
              className="w-fit rounded-full bg-zinc-900 px-5 py-2.5 text-sm font-medium text-white transition-colors hover:bg-zinc-700 dark:bg-zinc-50 dark:text-zinc-900 dark:hover:bg-zinc-200"
            >
              완성본 수락하기
            </button>
          </form>
        ) : (
          isSelectedSeller && (
            <p className="mt-4 text-sm text-zinc-500 dark:text-zinc-400">
              의뢰자가 완성본을 확인하고 있습니다. 수락하면 계좌 정보가 공개됩니다.
            </p>
          )
        ))}

      {/* B. 계좌 공개 + 이체 대기 */}
      {stage === "awaiting_transfer" &&
        (isRequester ? (
          <div className="mt-4 flex flex-col gap-3">
            <div className="rounded-lg border border-zinc-200 p-4 text-sm dark:border-zinc-800">
              <h3 className="text-sm font-semibold text-zinc-500 dark:text-zinc-400">
                제작자 계좌
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
                  제작자가 아직 정산 계좌를 등록하지 않았습니다. 비공개 스레드로 문의해주세요.
                </p>
              )}
            </div>

            <DirectDealNotice />

            <form action={markTransferSentAction} className="mt-1 flex flex-col gap-3">
              <input type="hidden" name="requestId" value={requestId} />
              <input type="hidden" name="proposalId" value={summary.proposal.id} />
              <div className="flex flex-col gap-1.5">
                <label htmlFor="transferProof" className="text-xs font-medium text-zinc-500 dark:text-zinc-400">
                  이체 증빙 스크린샷 (선택)
                </label>
                <input
                  id="transferProof"
                  name="transferProof"
                  type="file"
                  accept="image/png, image/jpeg, image/webp"
                  className="rounded-lg border border-zinc-300 px-3 py-2 text-sm outline-none file:mr-3 file:rounded-md file:border-0 file:bg-zinc-100 file:px-3 file:py-1.5 file:text-sm dark:border-zinc-700 dark:bg-zinc-900 dark:file:bg-zinc-800"
                />
              </div>
              <button
                type="submit"
                className="w-fit rounded-full bg-zinc-900 px-5 py-2.5 text-sm font-medium text-white transition-colors hover:bg-zinc-700 dark:bg-zinc-50 dark:text-zinc-900 dark:hover:bg-zinc-200"
              >
                이체 완료 표시하기
              </button>
            </form>
          </div>
        ) : (
          isSelectedSeller && (
            <p className="mt-4 text-sm text-zinc-500 dark:text-zinc-400">
              의뢰자가 완성본을 수락했습니다. 등록한 계좌로 이체를 기다리는 중입니다.
            </p>
          )
        ))}

      {/* C. 제작자 입금 확인 대기 */}
      {stage === "awaiting_payment_confirm" &&
        (isSelectedSeller ? (
          <div className="mt-4 flex flex-col gap-3">
            {summary.proposal.transferProofUrl && (
              <div>
                <h3 className="text-xs font-medium text-zinc-500 dark:text-zinc-400">
                  이체 증빙
                </h3>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={`/api/requests/${requestId}/delivery/asset/transfer-proof`}
                  alt="이체 증빙 스크린샷"
                  className="mt-2 h-28 w-28 rounded-lg object-cover ring-1 ring-zinc-950/[0.08]"
                />
              </div>
            )}
            <form action={confirmPaymentAction} className="flex flex-col gap-3">
              <input type="hidden" name="requestId" value={requestId} />
              <input type="hidden" name="proposalId" value={summary.proposal.id} />
              <p className="text-xs text-zinc-500 dark:text-zinc-400">
                의뢰자가 이체 완료를 표시했습니다. 계좌 입금을 확인한 뒤에만 눌러주세요 -
                입금을 확인하면 의뢰자의 완성본 다운로드가 열립니다.
              </p>
              <button
                type="submit"
                className="w-fit rounded-full bg-zinc-900 px-5 py-2.5 text-sm font-medium text-white transition-colors hover:bg-zinc-700 dark:bg-zinc-50 dark:text-zinc-900 dark:hover:bg-zinc-200"
              >
                입금 확인하기
              </button>
            </form>
          </div>
        ) : (
          isRequester && (
            <p className="mt-4 text-sm text-zinc-500 dark:text-zinc-400">
              이체 완료를 표시했습니다. 제작자의 입금 확인을 기다리는 중입니다. 입금이
              확인되면 완성본 다운로드가 열립니다.
            </p>
          )
        ))}

      {stage === "done" && alreadyCompleted && (isRequester || isSelectedSeller) && (
        <p className="mt-4 text-sm text-zinc-500 dark:text-zinc-400">거래가 완료되었습니다.</p>
      )}
    </section>
  );
}
