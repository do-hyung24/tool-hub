import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { put } from "@vercel/blob";
import { fileTypeFromBuffer } from "file-type";
import sharp from "sharp";
import { getCurrentSellerId } from "@/lib/session";
import { createToolRequest, addToolRequestImages } from "@/lib/data";

const MAX_IMAGE_SIZE_BYTES = 2 * 1024 * 1024; // 프로필 사진과 동일 한도
const MAX_IMAGES = 5;
const ALLOWED_MIME_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);
const MAX_DIMENSION_PX = 1600; // 아바타처럼 정사각형 크롭이 아니라 최대 변 길이만 제한, 비율 유지

const TITLE_MIN_LENGTH = 2;
const CONTENT_MIN_LENGTH = 5;
const REQUIRED_ENVIRONMENT_MAX_LENGTH = 200;
const DATE_ONLY_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

// 참고 영상 링크는 대략적인 URL 형태만 검증한다 - 특정 플랫폼 화이트리스트는 두지 않는다.
function isValidHttpUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}

// KST(UTC+9) 기준 오늘/6개월 후 날짜를 YYYY-MM-DD로 계산한다. 클라이언트의
// <input type="date"> min/max는 devtools 등으로 우회 가능하므로 서버에서도
// 동일한 범위를 다시 검증한다.
function getKstDeadlineBounds(): { min: string; max: string } {
  const kstNow = new Date(Date.now() + 9 * 60 * 60 * 1000);
  const min = kstNow.toISOString().slice(0, 10);
  const kstMax = new Date(kstNow.getTime());
  kstMax.setUTCMonth(kstMax.getUTCMonth() + 6);
  const max = kstMax.toISOString().slice(0, 10);
  return { min, max };
}

// 의뢰 이미지 한 장을 검증하고, 최대 변 길이를 유지한 webp로 재인코딩한다.
// 실패 시 에러 메시지 문자열을 반환하고, 성공 시 처리된 버퍼를 반환한다.
async function processRequestImage(
  file: File
): Promise<{ error: string } | { buffer: Buffer }> {
  if (file.name.toLowerCase().endsWith(".svg") || file.type === "image/svg+xml") {
    return { error: "SVG 형식은 업로드할 수 없습니다." };
  }

  if (file.size > MAX_IMAGE_SIZE_BYTES) {
    return { error: "이미지 파일 용량은 2MB를 넘을 수 없습니다." };
  }

  const inputBuffer = Buffer.from(await file.arrayBuffer());

  const detectedType = await fileTypeFromBuffer(inputBuffer);
  if (!detectedType || !ALLOWED_MIME_TYPES.has(detectedType.mime)) {
    return { error: "jpg, png, webp 형식의 이미지만 업로드할 수 있습니다." };
  }

  const processedBuffer = await sharp(inputBuffer)
    .resize(MAX_DIMENSION_PX, MAX_DIMENSION_PX, { fit: "inside", withoutEnlargement: true })
    .webp({ quality: 85 })
    .toBuffer();

  return { buffer: processedBuffer };
}

// 자동화 툴 의뢰를 생성한다. 텍스트 필드 + 참고 사진(1~5장)을 함께 받는다.
// 이미지 검증/처리가 모두 끝난 뒤에만 DB/Blob에 쓰기를 시작한다 - 중간에
// 하나라도 실패하면 아직 아무것도 저장되지 않았으므로 롤백이 필요 없다.
export async function POST(request: Request) {
  const sellerId = await getCurrentSellerId();
  if (!sellerId) {
    return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });
  }

  const formData = await request.formData();

  const title = String(formData.get("title") ?? "").trim();
  const description = String(formData.get("description") ?? "").trim();
  const budgetAmountRaw = formData.get("budgetAmount");
  const budgetNegotiable = formData.get("budgetNegotiable") === "on";
  const desiredDeadlineRaw = formData.get("desiredDeadline");
  const requiredEnvironmentRaw = formData.get("requiredEnvironment");
  const referenceVideoUrlRaw = formData.get("referenceVideoUrl");

  if (title.length < TITLE_MIN_LENGTH) {
    return NextResponse.json(
      { error: `제목은 ${TITLE_MIN_LENGTH}자 이상 입력해주세요.` },
      { status: 400 }
    );
  }
  if (description.length < CONTENT_MIN_LENGTH) {
    return NextResponse.json(
      { error: `내용은 ${CONTENT_MIN_LENGTH}자 이상 입력해주세요.` },
      { status: 400 }
    );
  }

  let budgetAmount: number | null = null;
  if (typeof budgetAmountRaw === "string" && budgetAmountRaw.trim() !== "") {
    const parsed = Number(budgetAmountRaw);
    if (!Number.isFinite(parsed) || parsed < 0) {
      return NextResponse.json(
        { error: "예산은 0 이상의 숫자로 입력해주세요." },
        { status: 400 }
      );
    }
    budgetAmount = parsed;
  }

  const desiredDeadline =
    typeof desiredDeadlineRaw === "string" && desiredDeadlineRaw.trim() !== ""
      ? desiredDeadlineRaw.trim()
      : null;
  if (desiredDeadline !== null) {
    const { min, max } = getKstDeadlineBounds();
    const isInRange =
      DATE_ONLY_PATTERN.test(desiredDeadline) && desiredDeadline >= min && desiredDeadline <= max;
    if (!isInRange) {
      return NextResponse.json(
        { error: "희망 완료 시점은 오늘부터 6개월 이내로 선택해주세요." },
        { status: 400 }
      );
    }
  }

  const requiredEnvironment =
    typeof requiredEnvironmentRaw === "string" && requiredEnvironmentRaw.trim() !== ""
      ? requiredEnvironmentRaw.trim()
      : null;
  if (requiredEnvironment !== null && requiredEnvironment.length > REQUIRED_ENVIRONMENT_MAX_LENGTH) {
    return NextResponse.json(
      { error: `필요한 프로그램/환경은 ${REQUIRED_ENVIRONMENT_MAX_LENGTH}자 이하로 입력해주세요.` },
      { status: 400 }
    );
  }

  let referenceVideoUrl: string | null = null;
  if (typeof referenceVideoUrlRaw === "string" && referenceVideoUrlRaw.trim() !== "") {
    const trimmed = referenceVideoUrlRaw.trim();
    if (!isValidHttpUrl(trimmed)) {
      return NextResponse.json(
        { error: "참고 영상 링크 형식이 올바르지 않습니다." },
        { status: 400 }
      );
    }
    referenceVideoUrl = trimmed;
  }

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
    title,
    description,
    budgetAmount,
    budgetNegotiable,
    desiredDeadline,
    requiredEnvironment,
    referenceVideoUrl,
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
