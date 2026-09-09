import { NextResponse } from "next/server";
import { get } from "@vercel/blob";
import { getSellerById } from "@/lib/data";

// 프로필 사진은 private 접근으로 Blob에 저장되므로, 브라우저에서 직접 URL을
// 사용할 수 없다. 이 라우트가 서버에서 Blob을 읽어 그대로 스트리밍해준다.
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ sellerId: string }> }
) {
  const { sellerId } = await params;
  const seller = await getSellerById(sellerId);
  if (!seller?.profileImageUrl) {
    return NextResponse.json({ error: "프로필 사진이 없습니다." }, { status: 404 });
  }

  const blob = await get(seller.profileImageUrl, { access: "private" });
  if (!blob || blob.statusCode !== 200) {
    return NextResponse.json({ error: "프로필 사진을 불러올 수 없습니다." }, { status: 404 });
  }

  return new NextResponse(blob.stream, {
    headers: {
      "Content-Type": "image/webp",
      "Cache-Control": "private, no-store",
    },
  });
}
