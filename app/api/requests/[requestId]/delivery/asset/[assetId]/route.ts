import { NextResponse } from "next/server";
import { get } from "@vercel/blob";
import { getCurrentSellerId } from "@/lib/session";
import {
  getToolProposalDeliveryProofById,
  getToolRequestById,
  listToolProposalsForRequest,
} from "@/lib/data";

// 작동 증빙(스크린샷/영상)과 이체 증빙 스크린샷을 위한 게이트 라우트.
// 다운로드 라우트(../download)와 동일한 당사자 판정(의뢰자 본인 또는 선택된
// 제안의 판매자 본인)을 쓰되, 결제 확인 여부는 확인하지 않는다 - 증빙은
// 결제 이전(수락 판단·이체 확인 단계)에도 당사자에게 보여야 하기 때문이다.
// assetId는 세 가지 중 하나다:
//   - "video"           → tool_proposals.delivery_proof_video_url
//   - "transfer-proof"  → tool_proposals.transfer_proof_url
//   - 그 외(UUID)        → tool_proposal_delivery_proofs.id (스크린샷 한 장)
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ requestId: string; assetId: string }> }
) {
  const sellerId = await getCurrentSellerId();
  if (!sellerId) {
    return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });
  }

  const { requestId, assetId } = await params;
  const toolRequest = await getToolRequestById(requestId);
  if (!toolRequest) {
    return NextResponse.json({ error: "의뢰를 찾을 수 없습니다." }, { status: 404 });
  }

  const proposals = await listToolProposalsForRequest(requestId);
  const selectedProposal = proposals.find((proposal) => proposal.status === "selected");

  const isRequester = sellerId === toolRequest.requesterSellerId;
  const isSelectedSeller = !!selectedProposal && sellerId === selectedProposal.sellerId;
  if (!isRequester && !isSelectedSeller) {
    return NextResponse.json({ error: "권한이 없습니다." }, { status: 403 });
  }
  if (!selectedProposal) {
    return NextResponse.json({ error: "완성본을 찾을 수 없습니다." }, { status: 404 });
  }

  let blobUrl: string | null;
  let contentType: string;
  if (assetId === "video") {
    blobUrl = selectedProposal.deliveryProofVideoUrl;
    contentType = "video/mp4";
  } else if (assetId === "transfer-proof") {
    blobUrl = selectedProposal.transferProofUrl;
    contentType = "image/webp";
  } else {
    const proof = await getToolProposalDeliveryProofById(assetId);
    if (!proof || proof.proposalId !== selectedProposal.id) {
      return NextResponse.json({ error: "찾을 수 없습니다." }, { status: 404 });
    }
    blobUrl = proof.imageUrl;
    contentType = "image/webp";
  }

  if (!blobUrl) {
    return NextResponse.json({ error: "찾을 수 없습니다." }, { status: 404 });
  }

  const blob = await get(blobUrl, { access: "private" });
  if (!blob || blob.statusCode !== 200) {
    return NextResponse.json({ error: "불러올 수 없습니다." }, { status: 404 });
  }

  return new NextResponse(blob.stream, { headers: { "Content-Type": contentType } });
}
