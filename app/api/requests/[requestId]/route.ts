import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { put } from "@vercel/blob";
import { getCurrentSellerId } from "@/lib/session";
import {
  deleteToolRequest,
  getToolRequestById,
  getToolRequestImageById,
  replaceToolRequestImages,
  updateToolRequest,
} from "@/lib/data";
import { MAX_IMAGES, processRequestImage, validateToolRequestFields } from "../shared";

// 의뢰 수정. 'open' 상태(아직 제안을 선택하지 않은 상태)일 때만 허용한다 -
// 등록 시 검증/이미지 처리 로직은 app/api/requests/shared.ts를 그대로 재사용한다.
export async function PATCH(
  request: Request,
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
  if (toolRequest.requesterSellerId !== sellerId) {
    return NextResponse.json({ error: "권한이 없습니다." }, { status: 403 });
  }
  if (toolRequest.status !== "open") {
    return NextResponse.json({ error: "모집중인 의뢰만 수정할 수 있습니다." }, { status: 400 });
  }

  const formData = await request.formData();

  const validated = validateToolRequestFields(formData);
  if ("error" in validated) {
    return NextResponse.json({ error: validated.error }, { status: 400 });
  }
  const { fields } = validated;

  // 유지할 기존 사진 id(순서대로 여러 개 append됨) + 새로 첨부한 파일.
  const keepImageIds = formData
    .getAll("keepImageIds")
    .filter((value): value is string => typeof value === "string" && value !== "");
  const newImageFiles = formData.getAll("images").filter((value): value is File => value instanceof File);

  const totalImageCount = keepImageIds.length + newImageFiles.length;
  if (totalImageCount === 0) {
    return NextResponse.json({ error: "사진을 최소 1장 첨부해주세요." }, { status: 400 });
  }
  if (totalImageCount > MAX_IMAGES) {
    return NextResponse.json(
      { error: `사진은 최대 ${MAX_IMAGES}장까지 첨부할 수 있습니다.` },
      { status: 400 }
    );
  }

  const keptImageUrls: string[] = [];
  for (const imageId of keepImageIds) {
    const image = await getToolRequestImageById(imageId);
    if (!image || image.requestId !== requestId) {
      return NextResponse.json({ error: "잘못된 이미지 정보입니다." }, { status: 400 });
    }
    keptImageUrls.push(image.imageUrl);
  }

  const processedBuffers: Buffer[] = [];
  for (const file of newImageFiles) {
    const result = await processRequestImage(file);
    if ("error" in result) {
      return NextResponse.json({ error: result.error }, { status: 400 });
    }
    processedBuffers.push(result.buffer);
  }

  // 여기까지 왔으면 모든 검증/이미지 처리가 끝났다 - 이제부터 DB/Blob에 쓴다.
  await updateToolRequest({ id: requestId, ...fields });

  const newImageUrls: string[] = [];
  for (let i = 0; i < processedBuffers.length; i++) {
    const blob = await put(
      `request-images/${requestId}-${i}-${randomUUID()}.webp`,
      processedBuffers[i],
      { access: "private", contentType: "image/webp" }
    );
    newImageUrls.push(blob.url);
  }

  await replaceToolRequestImages(requestId, [...keptImageUrls, ...newImageUrls]);

  return NextResponse.json({ id: requestId }, { status: 200 });
}

// 의뢰 삭제. 'open' 상태일 때만 허용한다(제안이 선택된 뒤에는 상대방이
// 이미 작업을 진행 중일 수 있으므로 삭제를 막는다).
export async function DELETE(
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
  if (toolRequest.requesterSellerId !== sellerId) {
    return NextResponse.json({ error: "권한이 없습니다." }, { status: 403 });
  }
  if (toolRequest.status !== "open") {
    return NextResponse.json({ error: "모집중인 의뢰만 삭제할 수 있습니다." }, { status: 400 });
  }

  await deleteToolRequest(requestId);

  return NextResponse.json({ ok: true }, { status: 200 });
}
