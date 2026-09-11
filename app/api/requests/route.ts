import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { put } from "@vercel/blob";
import { getCurrentSellerId } from "@/lib/session";
import { createToolRequest, addToolRequestImages } from "@/lib/data";
import { MAX_IMAGES, processRequestImage, validateToolRequestFields } from "./shared";

// 자동화 툴 의뢰를 생성한다. 텍스트 필드 + 참고 사진(1~5장)을 함께 받는다.
// 이미지 검증/처리가 모두 끝난 뒤에만 DB/Blob에 쓰기를 시작한다 - 중간에
// 하나라도 실패하면 아직 아무것도 저장되지 않았으므로 롤백이 필요 없다.
export async function POST(request: Request) {
  const sellerId = await getCurrentSellerId();
  if (!sellerId) {
    return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });
  }

  const formData = await request.formData();

  const validated = validateToolRequestFields(formData);
  if ("error" in validated) {
    return NextResponse.json({ error: validated.error }, { status: 400 });
  }
  const { fields } = validated;

  const imageFiles = formData.getAll("images").filter((value): value is File => value instanceof File);

  if (imageFiles.length === 0) {
    return NextResponse.json({ error: "사진을 최소 1장 첨부해주세요." }, { status: 400 });
  }
  if (imageFiles.length > MAX_IMAGES) {
    return NextResponse.json(
      { error: `사진은 최대 ${MAX_IMAGES}장까지 첨부할 수 있습니다.` },
      { status: 400 }
    );
  }

  const processedBuffers: Buffer[] = [];
  for (const file of imageFiles) {
    const result = await processRequestImage(file);
    if ("error" in result) {
      return NextResponse.json({ error: result.error }, { status: 400 });
    }
    processedBuffers.push(result.buffer);
  }

  // 여기까지 왔으면 모든 검증/이미지 처리가 끝났다 - 이제부터 DB/Blob에 쓴다.
  const toolRequest = await createToolRequest({
    requesterSellerId: sellerId,
    ...fields,
  });

  // 이 환경의 Blob 스토어가 private 전용으로 구성되어 있어 access:"public" 업로드는
  // API 레벨에서 거부된다. 그래서 private로 저장하고, 대신 인증 없는 공개 프록시
  // (GET /api/requests/images/[imageId])가 서버에서 읽어 스트리밍해준다 - 의뢰 사진은
  // 원래 공개 정보이므로 프록시에는 로그인/소유권 체크가 없다.
  const imageUrls: string[] = [];
  for (let i = 0; i < processedBuffers.length; i++) {
    const blob = await put(
      `request-images/${toolRequest.id}-${i}-${randomUUID()}.webp`,
      processedBuffers[i],
      { access: "private", contentType: "image/webp" }
    );
    imageUrls.push(blob.url);
  }

  await addToolRequestImages(toolRequest.id, imageUrls);

  return NextResponse.json({ id: toolRequest.id }, { status: 201 });
}
