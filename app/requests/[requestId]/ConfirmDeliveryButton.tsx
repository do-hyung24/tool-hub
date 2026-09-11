"use client";

import { useState } from "react";
import { ScanSummaryCard } from "@/app/_components/ScanSummaryCard";
import { confirmDeliveryAction } from "@/app/requestActions";
import type { PublicFindingGroup } from "@/lib/findingCategories";
import type { Listing, ToolProposal } from "@/lib/types";

// summary는 의뢰자 본인 또는 선택된(납품 확정된) 제안의 판매자 본인일 때만
// 상위 페이지에서 조회해 내려준다. null이면 아직 스캔 게이트를 통과하지 않았거나
// 열람 권한이 없다는 뜻이라 블록 자체를 렌더링하지 않는다.
// 스캔 요약은 summary가 있으면 항상 보여주고, 확인/결제 버튼은 의뢰자
// 본인(canConfirm)에게만 보여준다.
export function ConfirmDeliveryButton({
  requestId,
  summary,
  canConfirm,
  alreadyCompleted,
}: {
  requestId: string;
  summary: { proposal: ToolProposal; listing: Listing; findings: PublicFindingGroup[] } | null;
  canConfirm: boolean;
  alreadyCompleted: boolean;
}) {
  // 체크는 버튼 활성화만 클라에서 제어한다 - confirmDeliveryAction 자체의
  // 권한 검증(로그인/소유자)은 서버에서 그대로 유지되고, 이 체크 여부는
  // 별도로 서버에 전달/검증하지 않는다(결제를 막는 보안 장치가 아니라
  // 인수인계를 유도하는 UX 넛지다).
  const [operationConfirmed, setOperationConfirmed] = useState(false);

  if (!summary) {
    return null;
  }

  return (
    <section className="mt-10 border-t border-zinc-200 pt-8 dark:border-zinc-800">
      <h2 className="text-sm font-semibold">완성본 도착</h2>
      <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
        {canConfirm
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

      <ScanSummaryCard
        className="mt-4"
        groups={summary.findings}
        disclosureNote={summary.listing.disclosureNote}
      />

      {canConfirm &&
        (alreadyCompleted ? (
          <p className="mt-4 text-sm text-zinc-500 dark:text-zinc-400">
            결제(더미)가 완료된 의뢰입니다.
          </p>
        ) : (
          <form action={confirmDeliveryAction} className="mt-4 flex flex-col gap-3">
            <input type="hidden" name="requestId" value={requestId} />
            <p className="text-xs text-zinc-500 dark:text-zinc-400">
              결제 전 비공개 스레드에서 제작자에게 설치·사용법을 안내받으세요.
            </p>
            <label className="flex items-start gap-2 text-sm text-zinc-700 dark:text-zinc-300">
              <input
                type="checkbox"
                checked={operationConfirmed}
                onChange={(event) => setOperationConfirmed(event.target.checked)}
                className="mt-0.5 h-4 w-4 rounded border-zinc-300 dark:border-zinc-700"
              />
              제작자에게 설치·사용법을 안내받았고, 실제 작동을 확인했습니다.
            </label>
            <button
              type="submit"
              disabled={!operationConfirmed}
              className="w-fit rounded-full bg-zinc-900 px-5 py-2.5 text-sm font-medium text-white transition-colors hover:bg-zinc-700 disabled:cursor-not-allowed disabled:opacity-40 dark:bg-zinc-50 dark:text-zinc-900 dark:hover:bg-zinc-200"
            >
              확인 및 결제(더미) 완료하기
            </button>
          </form>
        ))}
    </section>
  );
}
