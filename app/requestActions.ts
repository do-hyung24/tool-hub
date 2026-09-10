"use server";

import { redirect } from "next/navigation";
import { headers } from "next/headers";
import {
  canDeliverProposal,
  clearProposalDeliveryConfirmation,
  completeToolRequest,
  confirmProposalDelivery,
  createDraftListing,
  getListingForOwner,
  getSellerById,
  getToolProposalById,
  getToolRequestById,
  markProposalDelivered,
  saveScanReport,
  updateListingSource,
} from "@/lib/data";
import { getCurrentSellerId } from "@/lib/session";
import { sendRequestDeliveryReadyEmail } from "@/lib/email";
import { runScan } from "@/lib/scanEngine";
import { RULE_ENGINE_VERSION } from "@/lib/detector";
import { collectFilesForSource, parseSourceType } from "@/app/actions";
import type { Finding, ToolRequestWithAuthor } from "@/lib/types";

// app/authActions.ts의 동일 헬퍼와 같은 방식으로 요청 origin을 만든다
// (그쪽은 export되지 않은 파일 내부 헬퍼라 여기에 동일하게 둔다).
async function getOrigin(): Promise<string> {
  const headerList = await headers();
  const host = headerList.get("host") ?? "localhost:3000";
  const proto =
    headerList.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https");
  return `${proto}://${host}`;
}

// app/actions.ts의 게시 분기와 동일한 기준(critical/high/medium)을 쓴다.
function hasUnresolvedFindings(findings: Finding[]): boolean {
  return findings.some((finding) => ["critical", "high", "medium"].includes(finding.severity));
}

// UI 가드와 별개로 서버 액션은 직접 POST될 수 있으므로, 납품 권한(선택된 제안의
// 판매자 본인인지)을 매번 다시 확인한다. canDeliverProposal은 제안의 status만 보므로,
// 의뢰 자체가 아직 진행중인지(= 의뢰자가 이미 확인/결제를 마치지 않았는지)는
// 여기서 함께 확인한다 - 완료된 의뢰에 완성본을 다시 밀어넣지 못하게 한다.
async function requireDeliverableProposal(formData: FormData): Promise<{
  sellerId: string;
  requestId: string;
  proposalId: string;
  toolRequest: ToolRequestWithAuthor;
}> {
  const sellerId = await getCurrentSellerId();
  if (!sellerId) {
    redirect("/login");
  }

  const requestId = String(formData.get("requestId") ?? "");
  const proposalId = String(formData.get("proposalId") ?? "");
  const [allowed, toolRequest] = await Promise.all([
    canDeliverProposal(requestId, proposalId, sellerId),
    getToolRequestById(requestId),
  ]);
  if (!allowed || !toolRequest || toolRequest.status !== "in_progress") {
    throw new Error("이 의뢰의 완성본을 제출할 권한이 없습니다.");
  }

  return { sellerId, requestId, proposalId, toolRequest };
}

// 스캔 게이트를 통과한 시점의 공통 처리.
// listings.published는 절대 건드리지 않는다 - 납품물은 공개 마켓에 노출되지 않고,
// "게이트 통과 + 의뢰자 통보 완료"는 tool_proposals.delivery_confirmed_at으로만 표현한다.
async function passDeliveryGate(requestId: string, proposalId: string): Promise<void> {
  await confirmProposalDelivery(proposalId);

  const toolRequest = await getToolRequestById(requestId);
  if (!toolRequest) return;

  const requester = await getSellerById(toolRequest.requesterSellerId);
  if (!requester?.email) return;

  const origin = await getOrigin();
  await sendRequestDeliveryReadyEmail(
    requester.email,
    toolRequest.title,
    `${origin}/requests/${requestId}`
  );
}

export async function submitDeliveryAction(formData: FormData) {
  const { sellerId, requestId, proposalId, toolRequest } =
    await requireDeliverableProposal(formData);

  const proposal = await getToolProposalById(proposalId);
  if (!proposal) {
    throw new Error("제안을 찾을 수 없습니다.");
  }

  // 재제출인 경우, 새 완성본이 스캔 게이트를 통과하기 전까지는 의뢰자 화면에
  // 이전 제출물의 "확인 완료" 상태가 남아있으면 안 된다(delivered_listing_id는
  // 곧 새 리스팅으로 옮겨가므로 확인 시점 기록을 먼저 되돌린다).
  await clearProposalDeliveryConfirmation(proposalId);

  const sourceType = await parseSourceType(formData);
  const { files, codeUrl } = await collectFilesForSource(sourceType, formData);

  // 납품용 리스팅은 스캔/리뷰 로직만 재사용하는 미게시(published=false) 행이다.
  // 제목/설명은 원 의뢰에서, 가격은 선택된 제안에서 그대로 가져오고, 공개 마켓에
  // 카테고리로 노출될 일이 없으므로 category는 고정값을 쓴다.
  const listing = await createDraftListing({
    title: toolRequest.title,
    description: toolRequest.description,
    price: proposal.price,
    category: "기타",
    codeUrl,
    sourceType,
    sellerId,
    sourceRequestId: requestId,
  });

  const findings = await runScan(files);
  const report = await saveScanReport({
    listingId: listing.id,
    authorId: sellerId,
    findings,
    ruleEngineVersion: RULE_ENGINE_VERSION,
  });

  await markProposalDelivered(proposalId, listing.id);

  if (!hasUnresolvedFindings(report.findings)) {
    await passDeliveryGate(requestId, proposalId);
    redirect(`/requests/${requestId}`);
  }

  redirect(`/requests/${requestId}/deliver/review`);
}

// /listings/[id]/review의 publishAnywayAction에 대응하지만, publishListing()을
// 호출하지 않는다(납품물은 공개 마켓에 올라가지 않는다).
export async function deliverPublishAnywayAction(formData: FormData) {
  const { requestId, proposalId } = await requireDeliverableProposal(formData);

  const proposal = await getToolProposalById(proposalId);
  if (!proposal?.deliveredListingId) {
    throw new Error("제출된 완성본을 찾을 수 없습니다.");
  }

  await passDeliveryGate(requestId, proposalId);

  redirect(`/requests/${requestId}`);
}

export async function deliverRescanAction(formData: FormData) {
  const { sellerId, requestId, proposalId } = await requireDeliverableProposal(formData);

  // 클라이언트가 보낸 listing id를 믿지 않고, 제안 행에 기록된 납품 리스팅을 쓴다.
  const proposal = await getToolProposalById(proposalId);
  const listingId = proposal?.deliveredListingId;
  if (!listingId) {
    throw new Error("제출된 완성본을 찾을 수 없습니다.");
  }

  const listing = await getListingForOwner(listingId, sellerId);
  if (!listing) {
    throw new Error("완성본을 찾을 수 없거나 접근 권한이 없습니다.");
  }

  const sourceType = await parseSourceType(formData);
  const { files, codeUrl } = await collectFilesForSource(sourceType, formData);

  // submitDeliveryAction과 동일한 이유: 소스를 교체하기 전에, 이전 제출물이 남긴
  // "확인 완료" 상태부터 되돌린다 - 새 코드가 게이트를 통과하기 전까지 의뢰자 화면에
  // 이전 확인 상태가 남아있으면 안 된다.
  await clearProposalDeliveryConfirmation(proposalId);

  await updateListingSource(listingId, { codeUrl, sourceType });

  const findings = await runScan(files);
  const report = await saveScanReport({
    listingId,
    authorId: sellerId,
    findings,
    ruleEngineVersion: RULE_ENGINE_VERSION,
  });

  if (!hasUnresolvedFindings(report.findings)) {
    await passDeliveryGate(requestId, proposalId);
    redirect(`/requests/${requestId}`);
  }

  redirect(`/requests/${requestId}/deliver/review`);
}

// 더미 결제: 별도 PG 호출 없이 의뢰 상태만 completed로 바꾼다.
export async function confirmDeliveryAction(formData: FormData) {
  const sellerId = await getCurrentSellerId();
  if (!sellerId) {
    redirect("/login");
  }

  const requestId = String(formData.get("requestId") ?? "");
  const completed = await completeToolRequest(requestId, sellerId);
  if (!completed) {
    throw new Error("의뢰를 완료 처리할 수 없습니다.");
  }

  redirect(`/requests/${requestId}?completed=1`);
}
