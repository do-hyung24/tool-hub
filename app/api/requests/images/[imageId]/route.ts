import { NextResponse } from "next/server";
import { get } from "@vercel/blob";
import { getToolRequestImageById } from "@/lib/data";

// 의뢰 사진은 private 접근으로 Blob에 저장되므로, 브라우저에서 직접 URL을
// 사용할 수 없다. 이 라우트가 서버에서 Blob을 읽어 그대로 스트리밍해준다.
// 프로필 사진 프록시와 달리 로그인/소유권 체크는 하지 않는다 - 의뢰 사진은
// 게시판 성격상 원래 공개 정보이기 때문이다. 매 업로드가 새 랜덤 파일명을
// 쓰므로 캐시 무효화 걱정 없이 장기 캐싱한다.
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ imageId: string }> }
) {
  const { imageId } = await params;
  const image = await getToolRequestImageById(imageId);
  if (!image) {
    return NextResponse.json({ error: "이미지를 찾을 수 없습니다." }, { status: 404 });
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
