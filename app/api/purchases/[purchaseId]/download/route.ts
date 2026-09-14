import { NextResponse } from "next/server";
import { get } from "@vercel/blob";
import { getCurrentSellerId } from "@/lib/session";
import { getListingDeliveryFileUrlForPurchase } from "@/lib/data";

// app/api/requests/[requestId]/delivery/download/route.ts와 같은 게이트 방식 -
// private Blob URL은 여기서만 읽고 클라이언트에는 절대 노출하지 않는다
// (스트리밍으로 그대로 전달). getListingDeliveryFileUrlForPurchase 자체가
// "이 구매 건의 구매자 본인 + 입금 확인 완료" 조건을 SQL에서 강제하므로,
// 그 외의 모든 경우(제3자/판매자/비로그인/미완료)는 null을 받아 404가 된다.
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ purchaseId: string }> }
) {
  const sellerId = await getCurrentSellerId();
  if (!sellerId) {
    return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });
  }

  const { purchaseId } = await params;
  const deliveryFileUrl = await getListingDeliveryFileUrlForPurchase(purchaseId, sellerId);
  if (!deliveryFileUrl) {
    return NextResponse.json({ error: "다운로드할 수 없습니다." }, { status: 404 });
  }

  const blob = await get(deliveryFileUrl, { access: "private" });
  if (!blob || blob.statusCode !== 200) {
    return NextResponse.json({ error: "완성본을 불러올 수 없습니다." }, { status: 404 });
  }

  const asciiFilename = `purchase-${purchaseId}.zip`;
  const utf8Filename = encodeURIComponent(`구매파일-${purchaseId}.zip`);

  return new NextResponse(blob.stream, {
    headers: {
      "Content-Type": "application/zip",
      "Content-Disposition": `attachment; filename="${asciiFilename}"; filename*=UTF-8''${utf8Filename}`,
    },
  });
}
