import { NextResponse } from "next/server";
import { get } from "@vercel/blob";
import { getToolRequestImageById, getToolRequestById, listToolProposalsForRequest } from "@/lib/data";
import { getCurrentSellerId } from "@/lib/session";

// 의뢰 사진은 private 접근으로 Blob에 저장되므로, 브라우저에서 직접 URL을
// 사용할 수 없다. 이 라우트가 서버에서 Blob을 읽어 그대로 스트리밍해준다.
// open/in_progress 의뢰의 사진은 게시판 성격상 원래 공개 정보라 로그인/소유권
// 체크를 하지 않는다(기존 동작 그대로). 다만 완료된 의뢰는 완료 사례 공개
// 정책상 첨부파일이 공개 여부(completed_content_public)와 무관하게 항상
// 비공개이므로, 그 경우에만 당사자(의뢰인 본인 또는 선택된 제안의 판매자
// 본인) 확인을 추가한다.
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ imageId: string }> }
) {
  const { imageId } = await params;
  const image = await getToolRequestImageById(imageId);
  if (!image) {
    return NextResponse.json({ error: "이미지를 찾을 수 없습니다." }, { status: 404 });
  }

  const toolRequest = await getToolRequestById(image.requestId);
  if (toolRequest?.status === "completed") {
    const sellerId = await getCurrentSellerId();
    const isRequester = !!sellerId && sellerId === toolRequest.requesterSellerId;
    const proposals = isRequester ? [] : await listToolProposalsForRequest(image.requestId);
    const isSelectedSeller =
      !isRequester &&
      !!sellerId &&
      proposals.some((proposal) => proposal.status === "selected" && proposal.sellerId === sellerId);
    if (!isRequester && !isSelectedSeller) {
      return NextResponse.json({ error: "권한이 없습니다." }, { status: 403 });
    }
  }

  const blob = await get(image.imageUrl, { access: "private" });
  if (!blob || blob.statusCode !== 200) {
    return NextResponse.json({ error: "이미지를 불러올 수 없습니다." }, { status: 404 });
  }

  return new NextResponse(blob.stream, {
    headers: {
      "Content-Type": "image/webp",
      "Cache-Control": "public, max-age=31536000, immutable",
    },
  });
}
