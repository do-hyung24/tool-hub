import { NextResponse } from "next/server";
import { get } from "@vercel/blob";
import { getCurrentSellerId } from "@/lib/session";
import { getToolRequestById, listToolProposalsForRequest } from "@/lib/data";

// 완성본(zip)을 "스캔받은 바로 그 파일 그대로" 다운로드하는 게이트 라우트.
// GitHub 제출은 이 라우트를 쓰지 않는다(UI에서 저장소 링크를 그대로 보여준다) -
// delivery_file_url이 없으면 404. private Blob URL은 여기서만 읽고 클라이언트에는
// 절대 노출하지 않는다(이미지 프록시와 동일한 스트리밍 방식).
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ requestId: string }> }
) {
  const sellerId = await getCurrentSellerId();
  if (!sellerId) {
    return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });
  }

  const { requestId } = await params;
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

  if (!selectedProposal?.deliveryFileUrl) {
    return NextResponse.json({ error: "다운로드할 완성본이 없습니다." }, { status: 404 });
  }

  const blob = await get(selectedProposal.deliveryFileUrl, { access: "private" });
  if (!blob || blob.statusCode !== 200) {
    return NextResponse.json({ error: "완성본을 불러올 수 없습니다." }, { status: 404 });
  }

  const asciiFilename = `delivery-${requestId}.zip`;
  const utf8Filename = encodeURIComponent(`완성본-${requestId}.zip`);

  return new NextResponse(blob.stream, {
    headers: {
      "Content-Type": "application/zip",
      "Content-Disposition": `attachment; filename="${asciiFilename}"; filename*=UTF-8''${utf8Filename}`,
    },
  });
}
