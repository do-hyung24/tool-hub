"use server";

import { randomUUID } from "node:crypto";
import { notFound, redirect } from "next/navigation";
import { headers } from "next/headers";
import { put } from "@vercel/blob";
import { fileTypeFromBuffer } from "file-type";
import {
  acceptProposalDelivery,
  canDeliverProposal,
  clearProposalDeliveryConfirmation,
  confirmProposalDelivery,
  confirmProposalPayment,
  createDraftListing,
  getListingForOwner,
  getSellerById,
  getToolProposalById,
  getToolRequestById,
  markProposalDelivered,
  markProposalTransferSent,
  replaceToolProposalDeliveryProofs,
  saveScanReport,
  updateListingSource,
  updateProposalDeliveryFile,
  updateProposalDeliveryGuide,
  updateProposalDeliveryProofVideo,
  updateToolRequestDisclosure,
} from "@/lib/data";
import { getCurrentSellerId } from "@/lib/session";
import { sendRequestDeliveryReadyEmail } from "@/lib/email";
import { runScan } from "@/lib/scanEngine";
import { RULE_ENGINE_VERSION } from "@/lib/detector";
import { collectFilesForSource, parseSourceType } from "@/app/actions";
import { processRequestImage } from "@/app/api/requests/shared";
import type { Finding, ToolRequestWithAuthor } from "@/lib/types";

// 완성본이 zip이면 스캔한 바로 그 버퍼를 private Blob에 저장하고 그 URL을
// 반환한다(원본 Blob URL은 어디에도 노출하지 않고 게이트 라우트로만 접근).
// GitHub 제출이면 null을 반환해 delivery_file_url을 비운다.
async function storeDeliveryFileIfZip(
  requestId: string,
  proposalId: string,
  zipBuffer: Buffer | null
): Promise<string | null> {
  if (!zipBuffer) return null;
  const blob = await put(`deliveries/${requestId}/${proposalId}-${randomUUID()}.zip`, zipBuffer, {
    access: "private",
    contentType: "application/zip",
  });
  return blob.url;
}

const MIN_DELIVERY_PROOF_IMAGES = 1;
const MAX_DELIVERY_PROOF_IMAGES = 5;
const MAX_PROOF_VIDEO_SIZE_BYTES = 20 * 1024 * 1024; // zip 업로드와 동일한 한도

// 완성본 제출 폼의 "proofImages" 파일들을 검증하고 webp로 재인코딩한다
// (app/api/requests/shared.ts의 processRequestImage 재사용 - 의뢰 사진과 동일한
// 검증 규칙). 실패하면 에러 메시지를 던진다 - DB/Blob 쓰기 이전에 먼저 걸러낸다.
async function collectDeliveryProofImages(formData: FormData): Promise<Buffer[]> {
  const files = formData.getAll("proofImages").filter((value): value is File => value instanceof File);
  if (files.length < MIN_DELIVERY_PROOF_IMAGES) {
    throw new Error("작동 화면 스크린샷을 최소 1장 첨부해주세요.");
  }
  if (files.length > MAX_DELIVERY_PROOF_IMAGES) {
    throw new Error(`작동 증빙 스크린샷은 최대 ${MAX_DELIVERY_PROOF_IMAGES}장까지 첨부할 수 있습니다.`);
  }
  const buffers: Buffer[] = [];
  for (const file of files) {
    const result = await processRequestImage(file);
    if ("error" in result) {
      throw new Error(result.error);
    }
    buffers.push(result.buffer);
  }
  return buffers;
}

// 선택 첨부인 작동 증빙 영상. mp4만 허용하며(별도 트랜스코딩 없음), 실제
// 파일 시그니처로 형식을 확인한다(확장자만 보고 판단하지 않음).
async function collectDeliveryProofVideo(formData: FormData): Promise<Buffer | null> {
  const file = formData.get("proofVideo");
  if (!(file instanceof File) || file.size === 0) {
    return null;
  }
  if (file.size > MAX_PROOF_VIDEO_SIZE_BYTES) {
    throw new Error("작동 증빙 영상은 20MB를 넘을 수 없습니다.");
  }
  const buffer = Buffer.from(await file.arrayBuffer());
  const detectedType = await fileTypeFromBuffer(buffer);
  if (!detectedType || detectedType.mime !== "video/mp4") {
    throw new Error("작동 증빙 영상은 mp4 형식만 첨부할 수 있습니다.");
  }
  return buffer;
}

async function storeDeliveryProofImages(
  requestId: string,
  proposalId: string,
  buffers: Buffer[]
): Promise<string[]> {
  const urls: string[] = [];
  for (let i = 0; i < buffers.length; i++) {
    const blob = await put(
      `delivery-proofs/${requestId}/${proposalId}-${i}-${randomUUID()}.webp`,
      buffers[i],
      { access: "private", contentType: "image/webp" }
    );
    urls.push(blob.url);
  }
  return urls;
}

async function storeDeliveryProofVideoIfPresent(
  requestId: string,
  proposalId: string,
  buffer: Buffer | null
): Promise<string | null> {
  if (!buffer) return null;
  const blob = await put(`delivery-proofs/${requestId}/${proposalId}-video-${randomUUID()}.mp4`, buffer, {
    access: "private",
    contentType: "video/mp4",
  });
  return blob.url;
}

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

const DELIVERY_GUIDE_MIN_LENGTH = 20;

// 클라이언트 폼(required/minLength)과 별개로 서버 액션에서도 반드시 다시
// 검증한다 - 폼 우회(직접 POST 등)로 실행 가이드 없는 제출을 막기 위해서다.
function requireDeliveryGuide(formData: FormData): string {
  const raw = formData.get("deliveryGuide");
  const deliveryGuide = typeof raw === "string" ? raw.trim() : "";
  if (deliveryGuide.length < DELIVERY_GUIDE_MIN_LENGTH) {
    throw new Error(`실행 가이드를 ${DELIVERY_GUIDE_MIN_LENGTH}자 이상 입력해주세요.`);
  }
  return deliveryGuide;
}

// redirect()는 try/catch 안에서 호출하면 안 된다(던져진 리다이렉트 신호를
// 검증 에러로 오인해 삼켜버릴 수 있다) - 그래서 로그인 확인은 항상 아래
// 위험 구간(try) 밖, 각 액션의 맨 앞에서 먼저 끝낸다.
async function requireCurrentSellerId(): Promise<string> {
  const sellerId = await getCurrentSellerId();
  if (!sellerId) {
    redirect("/login");
  }
  return sellerId;
}

// UI 가드와 별개로 서버 액션은 직접 POST될 수 있으므로, 납품 권한(선택된 제안의
// 판매자 본인인지)을 매번 다시 확인한다. canDeliverProposal은 제안의 status만 보므로,
// 의뢰 자체가 아직 진행중인지(= 의뢰자가 이미 확인/결제를 마치지 않았는지)는
// 여기서 함께 확인한다 - 완료된 의뢰에 완성본을 다시 밀어넣지 못하게 한다.
// sellerId는 호출부(requireCurrentSellerId)가 이미 로그인 여부까지 확인해
// 넘겨준다 - 이 함수 자체는 redirect를 호출하지 않아 try 블록 안에서 안전하게
// 쓸 수 있다.
async function requireDeliverableProposal(
  sellerId: string,
  formData: FormData
): Promise<{
  requestId: string;
  proposalId: string;
  toolRequest: ToolRequestWithAuthor;
}> {
  const requestId = String(formData.get("requestId") ?? "");
  const proposalId = String(formData.get("proposalId") ?? "");
  const [allowed, toolRequest] = await Promise.all([
    canDeliverProposal(requestId, proposalId, sellerId),
    getToolRequestById(requestId),
  ]);
  if (!allowed || !toolRequest || toolRequest.status !== "in_progress") {
    throw new Error("이 의뢰의 완성본을 제출할 권한이 없습니다.");
  }

  return { requestId, proposalId, toolRequest };
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

// 완성본 제출 폼(useActionState)의 반환 상태. 에러가 없으면 성공 후 redirect()로
// 이동하므로 컴포넌트가 이 상태를 렌더링할 일이 없다.
export type DeliveryFormState = { error?: string };

export async function submitDeliveryAction(
  _prevState: DeliveryFormState,
  formData: FormData
): Promise<DeliveryFormState> {
  const sellerId = await requireCurrentSellerId();

  let nextPath: string;
  try {
    const { requestId, proposalId, toolRequest } = await requireDeliverableProposal(
      sellerId,
      formData
    );

    const proposal = await getToolProposalById(proposalId);
    if (!proposal) {
      throw new Error("제안을 찾을 수 없습니다.");
    }

    const deliveryGuide = requireDeliveryGuide(formData);
    // 파일 검증은 DB/Blob에 아무것도 쓰기 전에 먼저 끝낸다(app/api/requests/route.ts와
    // 동일한 원칙) - 검증 실패 시 아직 아무 상태도 바뀌지 않아 롤백이 필요 없다.
    // zip 용량 초과 등 여기서 던져지는 에러는 아래 catch에서 폼 에러로 반환된다
    // (예전엔 처리되지 않은 예외로 페이지 전체가 에러 화면으로 대체됐다).
    const proofImageBuffers = await collectDeliveryProofImages(formData);
    const proofVideoBuffer = await collectDeliveryProofVideo(formData);

    // 재제출인 경우, 새 완성본이 스캔 게이트를 통과하기 전까지는 의뢰자 화면에
    // 이전 제출물의 "확인 완료" 상태가 남아있으면 안 된다(delivered_listing_id는
    // 곧 새 리스팅으로 옮겨가므로 확인 시점 기록을 먼저 되돌린다).
    await clearProposalDeliveryConfirmation(proposalId);

    const sourceType = await parseSourceType(formData);
    const { files, codeUrl, zipBuffer } = await collectFilesForSource(sourceType, formData);

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

    const deliveryFileUrl = await storeDeliveryFileIfZip(requestId, proposalId, zipBuffer);
    const proofImageUrls = await storeDeliveryProofImages(requestId, proposalId, proofImageBuffers);
    const proofVideoUrl = await storeDeliveryProofVideoIfPresent(requestId, proposalId, proofVideoBuffer);

    await markProposalDelivered(proposalId, listing.id);
    await updateProposalDeliveryGuide(proposalId, deliveryGuide);
    await updateProposalDeliveryFile(proposalId, deliveryFileUrl);
    await replaceToolProposalDeliveryProofs(proposalId, proofImageUrls);
    await updateProposalDeliveryProofVideo(proposalId, proofVideoUrl);

    if (!hasUnresolvedFindings(report.findings)) {
      await passDeliveryGate(requestId, proposalId);
      nextPath = `/requests/${requestId}`;
    } else {
      nextPath = `/requests/${requestId}/deliver/review`;
    }
  } catch (error) {
    if (error instanceof Error) {
      return { error: error.message };
    }
    throw error;
  }

  redirect(nextPath);
}

// /listings/[id]/review의 publishAnywayAction에 대응하지만, publishListing()을
// 호출하지 않는다(납품물은 공개 마켓에 올라가지 않는다).
export async function deliverPublishAnywayAction(formData: FormData) {
  const sellerId = await requireCurrentSellerId();
  const { requestId, proposalId } = await requireDeliverableProposal(sellerId, formData);

  const proposal = await getToolProposalById(proposalId);
  if (!proposal?.deliveredListingId) {
    throw new Error("제출된 완성본을 찾을 수 없습니다.");
  }

  await passDeliveryGate(requestId, proposalId);

  redirect(`/requests/${requestId}`);
}

export async function deliverRescanAction(
  _prevState: DeliveryFormState,
  formData: FormData
): Promise<DeliveryFormState> {
  const sellerId = await requireCurrentSellerId();

  let nextPath: string;
  try {
    const { requestId, proposalId } = await requireDeliverableProposal(sellerId, formData);

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

    const deliveryGuide = requireDeliveryGuide(formData);
    const proofImageBuffers = await collectDeliveryProofImages(formData);
    const proofVideoBuffer = await collectDeliveryProofVideo(formData);

    const sourceType = await parseSourceType(formData);
    const { files, codeUrl, zipBuffer } = await collectFilesForSource(sourceType, formData);

    // submitDeliveryAction과 동일한 이유: 소스를 교체하기 전에, 이전 제출물이 남긴
    // "확인 완료" 상태부터 되돌린다 - 새 코드가 게이트를 통과하기 전까지 의뢰자 화면에
    // 이전 확인 상태가 남아있으면 안 된다.
    await clearProposalDeliveryConfirmation(proposalId);

    const deliveryFileUrl = await storeDeliveryFileIfZip(requestId, proposalId, zipBuffer);
    const proofImageUrls = await storeDeliveryProofImages(requestId, proposalId, proofImageBuffers);
    const proofVideoUrl = await storeDeliveryProofVideoIfPresent(requestId, proposalId, proofVideoBuffer);

    await updateListingSource(listingId, { codeUrl, sourceType });
    await updateProposalDeliveryGuide(proposalId, deliveryGuide);
    await updateProposalDeliveryFile(proposalId, deliveryFileUrl);
    await replaceToolProposalDeliveryProofs(proposalId, proofImageUrls);
    await updateProposalDeliveryProofVideo(proposalId, proofVideoUrl);

    const findings = await runScan(files);
    const report = await saveScanReport({
      listingId,
      authorId: sellerId,
      findings,
      ruleEngineVersion: RULE_ENGINE_VERSION,
    });

    if (!hasUnresolvedFindings(report.findings)) {
      await passDeliveryGate(requestId, proposalId);
      nextPath = `/requests/${requestId}`;
    } else {
      nextPath = `/requests/${requestId}/deliver/review`;
    }
  } catch (error) {
    if (error instanceof Error) {
      return { error: error.message };
    }
    throw error;
  }

  redirect(nextPath);
}

// 의뢰인이 스캔 요약+실행 가이드+작동 증빙을 확인한 뒤 "수락"한다. 이 시점부터
// 제작자 계좌가 공개되고 이체 단계로 넘어간다. 이미 수락된 상태의 재호출(뒤로가기/
// 중복 클릭)은 acceptProposalDelivery가 멱등하게 true를 반환해 에러 없이 넘어간다.
export async function acceptDeliveryAction(formData: FormData) {
  const sellerId = await getCurrentSellerId();
  if (!sellerId) {
    redirect("/login");
  }

  const requestId = String(formData.get("requestId") ?? "");
  const proposalId = String(formData.get("proposalId") ?? "");
  const accepted = await acceptProposalDelivery(requestId, proposalId, sellerId);
  if (!accepted) {
    throw new Error("완성본을 수락할 수 없습니다.");
  }

  redirect(`/requests/${requestId}`);
}

// 의뢰인이 제작자 계좌로 이체한 뒤 "이체 완료"를 표시한다. 이체 증빙 스크린샷은
// 선택이다.
export async function markTransferSentAction(formData: FormData) {
  const sellerId = await getCurrentSellerId();
  if (!sellerId) {
    redirect("/login");
  }

  const requestId = String(formData.get("requestId") ?? "");
  const proposalId = String(formData.get("proposalId") ?? "");

  const proofFile = formData.get("transferProof");
  let transferProofUrl: string | null = null;
  if (proofFile instanceof File && proofFile.size > 0) {
    const result = await processRequestImage(proofFile);
    if ("error" in result) {
      throw new Error(result.error);
    }
    const blob = await put(
      `delivery-proofs/${requestId}/${proposalId}-transfer-${randomUUID()}.webp`,
      result.buffer,
      { access: "private", contentType: "image/webp" }
    );
    transferProofUrl = blob.url;
  }

  const marked = await markProposalTransferSent(requestId, proposalId, sellerId, transferProofUrl);
  if (!marked) {
    throw new Error("이체 완료를 표시할 수 없습니다.");
  }

  redirect(`/requests/${requestId}`);
}

// 제작자가 "입금 확인"을 표시한다. 이 호출이 성공하면 의뢰가 완료 처리되고,
// 의뢰인의 완성본 다운로드가 그때부터 열린다(다운로드 라우트가 별도로 확인).
export async function confirmPaymentAction(formData: FormData) {
  const sellerId = await getCurrentSellerId();
  if (!sellerId) {
    redirect("/login");
  }

  const requestId = String(formData.get("requestId") ?? "");
  const proposalId = String(formData.get("proposalId") ?? "");
  const confirmed = await confirmProposalPayment(requestId, proposalId, sellerId);
  if (!confirmed) {
    throw new Error("입금 확인을 처리할 수 없습니다.");
  }

  redirect(`/requests/${requestId}?completed=1`);
}

// 완료 사례 공개 정책((a)완료 후 의뢰 내용 공개 / (b)제작자 귀속 표시 동의)을
// 의뢰인 본인만 바꿀 수 있다 - 완료 이전/이후 상태와 무관하게 언제든 토글 가능.
export async function updateRequestDisclosureAction(formData: FormData) {
  const sellerId = await getCurrentSellerId();
  if (!sellerId) {
    redirect("/login");
  }

  const requestId = String(formData.get("requestId") ?? "");
  const toolRequest = await getToolRequestById(requestId);
  if (!toolRequest || toolRequest.requesterSellerId !== sellerId) {
    // throw는 500(서버 예외)로 응답해 의도된 거부와 실제 오류를 구분할 수 없게
    // 만든다 - 존재 여부도 함께 감추는 notFound()로 명확한 404를 반환한다.
    notFound();
  }

  const completedContentPublic = formData.get("completedContentPublic") === "on";
  const makerAttributionPublic = formData.get("makerAttributionPublic") === "on";
  await updateToolRequestDisclosure(requestId, { completedContentPublic, makerAttributionPublic });

  redirect(`/requests/${requestId}`);
}
