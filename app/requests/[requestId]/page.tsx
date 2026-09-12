import Link from "next/link";
import { notFound } from "next/navigation";
import {
  canAccessProposalThread,
  getDeliveryScanSummaryForViewer,
  getSettlementAccountForViewer,
  getToolRequestById,
  listToolProposalDeliveryProofs,
  listToolProposalMessages,
  listToolProposalsForRequest,
  listToolRequestImages,
} from "@/lib/data";
import { getCurrentSellerId } from "@/lib/session";
import { formatDate, formatPrice, getProfileImageSrc } from "@/lib/format";
import { COPYRIGHT_POLICY_NOTICE } from "@/lib/constants";
import { getKstTodayDateString } from "@/lib/dday";
import { DDayBadge } from "@/app/_components/DDayBadge";
import type { ToolProposalMessageWithAuthor, ToolRequestStatus } from "@/lib/types";
import { ConfirmDeliveryButton } from "./ConfirmDeliveryButton";
import { DeleteRequestButton } from "./DeleteRequestButton";
import { ProposalForm } from "./ProposalForm";
import { ProposalThread } from "./ProposalThread";
import { RequestImageGallery } from "./RequestImageGallery";
import { SelectProposalButton } from "./SelectProposalButton";

const STATUS_LABELS: Record<ToolRequestStatus, string> = {
  open: "모집중",
  in_progress: "진행중",
  completed: "완료",
};

// 새 폼은 <input type="date">로 저장하지만(YYYY-MM-DD), 이전에 자유 입력으로 저장된
// 값은 이 형식이 아닐 수 있으므로 그때는 원문 그대로 보여준다.
const DATE_ONLY_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
function formatDesiredDeadline(value: string): string {
  return DATE_ONLY_PATTERN.test(value) ? formatDate(value) : value;
}

export default async function ToolRequestDetailPage(props: PageProps<"/requests/[requestId]">) {
  const { requestId } = await props.params;

  const [toolRequest, images, proposals, sellerId] = await Promise.all([
    getToolRequestById(requestId),
    listToolRequestImages(requestId),
    listToolProposalsForRequest(requestId),
    getCurrentSellerId(),
  ]);

  if (!toolRequest) {
    notFound();
  }

  const today = getKstTodayDateString();

  const isRequester = !!sellerId && sellerId === toolRequest.requesterSellerId;
  const canSelectProposals = isRequester && toolRequest.status === "open";
  const canPropose = !!sellerId && sellerId !== toolRequest.requesterSellerId && toolRequest.status === "open";

  const selectedProposal = proposals.find((proposal) => proposal.status === "selected");
  const canAccessThread =
    !!selectedProposal &&
    !!sellerId &&
    (sellerId === toolRequest.requesterSellerId || sellerId === selectedProposal.sellerId) &&
    (await canAccessProposalThread(selectedProposal.id, sellerId));
  const threadMessages: ToolProposalMessageWithAuthor[] = canAccessThread
    ? await listToolProposalMessages(selectedProposal!.id)
    : [];

  const isSelectedSeller = !!sellerId && sellerId === selectedProposal?.sellerId;
  const canSubmitDelivery = isSelectedSeller && toolRequest.status === "in_progress";

  // 납품 스캔 요약은 의뢰자 본인 또는 선택된 제안의 판매자 본인일 때만 조회한다
  // (그 외 방문자에게는 조회 함수 자체를 호출하지 않는다).
  const deliverySummary =
    sellerId && (isRequester || isSelectedSeller)
      ? await getDeliveryScanSummaryForViewer(toolRequest.id, sellerId)
      : null;

  // 작동 증빙 스크린샷도 같은 당사자 조건(요약이 있을 때만)에서만 조회한다.
  const deliveryProofImages = deliverySummary
    ? await listToolProposalDeliveryProofs(deliverySummary.proposal.id)
    : [];

  // 제작자 계좌는 의뢰인 본인이 완성본을 수락한 뒤에만 채워진다(그 외에는
  // 함수 자체가 null을 반환) - 함수 내부에서 이중으로 다시 확인한다.
  const settlementAccount =
    sellerId && isRequester ? await getSettlementAccountForViewer(toolRequest.id, sellerId) : null;

  return (
    <main className="mx-auto w-full max-w-2xl flex-1 px-6 py-10">
      <Link href="/requests" className="text-sm text-zinc-500 hover:underline dark:text-zinc-400">
        ← 목록으로
      </Link>

      <div className="mt-4 flex items-center gap-2 text-xs text-zinc-500 dark:text-zinc-400">
        <span className="rounded-full bg-zinc-100 px-2 py-0.5 font-medium text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300">
          의뢰
        </span>
        <span>{STATUS_LABELS[toolRequest.status]}</span>
        <span>{formatDate(toolRequest.createdAt)}</span>
      </div>

      <div className="mt-2 flex items-start justify-between gap-4">
        <h1 className="text-2xl font-bold">{toolRequest.title}</h1>
        {isRequester && toolRequest.status === "open" && (
          <div className="flex shrink-0 items-center gap-2">
            <Link
              href={`/requests/${toolRequest.id}/edit`}
              className="rounded-full border border-zinc-300 px-3 py-1 text-xs font-medium text-zinc-600 transition-colors hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
            >
              수정
            </Link>
            <DeleteRequestButton requestId={toolRequest.id} />
          </div>
        )}
      </div>

      <div className="mt-3 flex items-center gap-2">
        <span className="text-sm text-zinc-600 dark:text-zinc-300">
          {toolRequest.requesterNickname}
        </span>
      </div>

      <p className="mt-6 whitespace-pre-wrap text-sm leading-relaxed text-zinc-700 dark:text-zinc-300">
        {toolRequest.description}
      </p>

      <dl className="mt-6 grid grid-cols-1 gap-3 text-sm sm:grid-cols-2">
        <div>
          <dt className="text-xs text-zinc-400 dark:text-zinc-500">예산</dt>
          <dd className="mt-0.5 text-zinc-700 dark:text-zinc-300">
            {toolRequest.budgetAmount !== null ? formatPrice(toolRequest.budgetAmount) : "미정"}
            {toolRequest.budgetNegotiable && " (협의 가능)"}
          </dd>
        </div>
        <div>
          <dt className="text-xs text-zinc-400 dark:text-zinc-500">희망 완료 시점</dt>
          <dd className="mt-0.5 text-zinc-700 dark:text-zinc-300">
            {toolRequest.desiredDeadline ? formatDesiredDeadline(toolRequest.desiredDeadline) : "미정"}
          </dd>
        </div>
        <div>
          <dt className="text-xs text-zinc-400 dark:text-zinc-500">필요한 프로그램/환경</dt>
          <dd className="mt-0.5 text-zinc-700 dark:text-zinc-300">
            {toolRequest.requiredEnvironment ?? "제한 없음"}
          </dd>
        </div>
      </dl>

      <RequestImageGallery images={images} />

      {toolRequest.referenceVideoUrl && (
        <p className="mt-4 text-sm">
          <a
            href={toolRequest.referenceVideoUrl}
            target="_blank"
            rel="noreferrer"
            className="text-zinc-600 underline hover:text-zinc-900 dark:text-zinc-300 dark:hover:text-zinc-50"
          >
            참고 영상 링크
          </a>
        </p>
      )}

      <section className="mt-10 border-t border-zinc-200 pt-8 dark:border-zinc-800">
        <h2 className="text-sm font-semibold">제안 {proposals.length}개</h2>

        <ul className="mt-4 flex flex-col gap-4">
          {proposals.length === 0 && (
            <li className="text-sm text-zinc-400 dark:text-zinc-500">아직 제안이 없습니다.</li>
          )}
          {proposals.map((proposal) => {
            const isSelected = proposal.status === "selected";
            const sellerImageSrc = getProfileImageSrc(proposal.sellerId, proposal.sellerProfileImageUrl);
            const sellerInitial = proposal.sellerNickname.trim().charAt(0) || "?";
            return (
              <li
                key={proposal.id}
                className={`flex flex-col gap-1.5 rounded-lg border p-4 ${
                  isSelected
                    ? "border-zinc-900 bg-zinc-50 dark:border-zinc-50 dark:bg-zinc-900"
                    : "border-zinc-200 dark:border-zinc-800"
                }`}
              >
                <div className="flex items-center justify-between gap-2">
                  <Link
                    href={`/sellers/${proposal.sellerId}`}
                    className="flex items-center gap-2 text-sm font-medium text-zinc-800 hover:underline dark:text-zinc-200"
                  >
                    {sellerImageSrc ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={sellerImageSrc}
                        alt=""
                        className="h-6 w-6 rounded-full object-cover"
                      />
                    ) : (
                      <span className="flex h-6 w-6 items-center justify-center rounded-full bg-zinc-200 text-xs font-semibold text-zinc-600 dark:bg-zinc-700 dark:text-zinc-300">
                        {sellerInitial}
                      </span>
                    )}
                    {proposal.sellerNickname}
                  </Link>
                  {isSelected && (
                    <span className="rounded-full bg-zinc-900 px-2 py-0.5 text-xs font-medium text-white dark:bg-zinc-50 dark:text-zinc-900">
                      선택됨
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-3 text-xs text-zinc-500 dark:text-zinc-400">
                  <span>{formatPrice(proposal.price)}</span>
                  <span>{proposal.duration}</span>
                </div>
                {proposal.proposedCompletionDate && DATE_ONLY_PATTERN.test(proposal.proposedCompletionDate) && (
                  <div className="flex items-center gap-2 text-xs text-zinc-500 dark:text-zinc-400">
                    <span>완료 예정일 {formatDate(proposal.proposedCompletionDate)}</span>
                    <DDayBadge today={today} deadline={proposal.proposedCompletionDate} />
                  </div>
                )}
                <p className="whitespace-pre-wrap text-sm text-zinc-700 dark:text-zinc-300">
                  {proposal.description}
                </p>
                {canSelectProposals && !isSelected && (
                  <SelectProposalButton requestId={toolRequest.id} proposalId={proposal.id} />
                )}
                {isSelected && canAccessThread && (
                  <ProposalThread proposalId={proposal.id} initialMessages={threadMessages} />
                )}
              </li>
            );
          })}
        </ul>

        {canPropose && <ProposalForm requestId={toolRequest.id} />}

        {canSubmitDelivery && (
          <Link
            href={`/requests/${toolRequest.id}/deliver`}
            className="mt-6 inline-block rounded-full bg-zinc-900 px-5 py-2.5 text-sm font-medium text-white transition-colors hover:bg-zinc-700 dark:bg-zinc-50 dark:text-zinc-900 dark:hover:bg-zinc-200"
          >
            완성본 제출하기
          </Link>
        )}
      </section>

      <ConfirmDeliveryButton
        requestId={toolRequest.id}
        summary={deliverySummary}
        proofImages={deliveryProofImages}
        settlementAccount={settlementAccount}
        isRequester={isRequester}
        isSelectedSeller={isSelectedSeller}
        alreadyCompleted={toolRequest.status === "completed"}
      />

      {toolRequest.status === "completed" && isSelectedSeller && (
        <div className="mt-6">
          <Link
            href={`/listings/new?sourceRequestId=${encodeURIComponent(toolRequest.id)}&title=${encodeURIComponent(toolRequest.title)}&description=${encodeURIComponent(toolRequest.description)}`}
            className="inline-block rounded-full bg-zinc-900 px-5 py-2.5 text-sm font-medium text-white transition-colors hover:bg-zinc-700 dark:bg-zinc-50 dark:text-zinc-900 dark:hover:bg-zinc-200"
          >
            이 툴 마켓에도 판매하기
          </Link>
          <p className="mt-2 text-xs text-zinc-400 dark:text-zinc-500">{COPYRIGHT_POLICY_NOTICE}</p>
        </div>
      )}
    </main>
  );
}
