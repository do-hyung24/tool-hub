import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { put, del } from "@vercel/blob";
import { fileTypeFromBuffer } from "file-type";
import sharp from "sharp";
import { getCurrentSellerId } from "@/lib/session";
import { getSellerById, updateSellerProfileImage } from "@/lib/data";

const MAX_FILE_SIZE_BYTES = 2 * 1024 * 1024; // 2MB
const ALLOWED_MIME_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);
const AVATAR_SIZE_PX = 256;

// 본인 계정의 프로필 사진을 업로드/교체한다. 실제 파일 시그니처(magic bytes)로
// 형식을 확인하고(확장자만 보고 판단하지 않음), 256x256으로 리사이즈 + 재인코딩하여
// EXIF 메타데이터를 제거한 뒤 Vercel Blob에 저장한다.
export async function POST(request: Request) {
  const sellerId = await getCurrentSellerId();
  if (!sellerId) {
    return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });
  }

  const formData = await request.formData();
  const file = formData.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "이미지 파일을 선택해주세요." }, { status: 400 });
  }

  if (file.name.toLowerCase().endsWith(".svg") || file.type === "image/svg+xml") {
    return NextResponse.json({ error: "SVG 형식은 업로드할 수 없습니다." }, { status: 400 });
  }

  if (file.size > MAX_FILE_SIZE_BYTES) {
    return NextResponse.json({ error: "파일 용량은 2MB를 넘을 수 없습니다." }, { status: 400 });
  }

  const inputBuffer = Buffer.from(await file.arrayBuffer());

  const detectedType = await fileTypeFromBuffer(inputBuffer);
  if (!detectedType || !ALLOWED_MIME_TYPES.has(detectedType.mime)) {
    return NextResponse.json(
      { error: "jpg, png, webp 형식의 이미지만 업로드할 수 있습니다." },
      { status: 400 }
    );
  }

  const processedBuffer = await sharp(inputBuffer)
    .resize(AVATAR_SIZE_PX, AVATAR_SIZE_PX, { fit: "cover" })
    .webp({ quality: 85 })
    .toBuffer();

  const existingSeller = await getSellerById(sellerId);
  const previousImageUrl = existingSeller?.profileImageUrl ?? null;

  const blob = await put(`profile-images/${sellerId}-${randomUUID()}.webp`, processedBuffer, {
    access: "private",
    contentType: "image/webp",
  });

  await updateSellerProfileImage(sellerId, blob.url);

  if (previousImageUrl) {
    try {
      await del(previousImageUrl);
    } catch (error) {
      // 이전 파일 삭제 실패는 새 업로드 자체를 실패시키지 않는다 - 다음 교체 시
      // 다시 시도되거나, 최악의 경우 Blob에 고아 파일이 남는 정도로 그친다.
      console.error(`[프로필 사진 업로드] 이전 이미지 삭제 실패 (seller ${sellerId}):`, error);
    }
  }

  return NextResponse.json({ profileImageUrl: blob.url });
}
