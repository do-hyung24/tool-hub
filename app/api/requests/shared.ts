import { fileTypeFromBuffer } from "file-type";
import sharp from "sharp";

// POST /api/requests(등록)와 PATCH /api/requests/[requestId](수정)가
// 공유하는 검증/이미지 처리 로직. 두 라우트의 필드 검증 규칙은 반드시
// 동일해야 하므로 한 곳에 둔다.

export const MAX_IMAGE_SIZE_BYTES = 2 * 1024 * 1024; // 프로필 사진과 동일 한도
export const MAX_IMAGES = 5;
const ALLOWED_MIME_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);
const MAX_DIMENSION_PX = 1600; // 아바타처럼 정사각형 크롭이 아니라 최대 변 길이만 제한, 비율 유지

export const TITLE_MIN_LENGTH = 2;
export const CONTENT_MIN_LENGTH = 30; // 폼(app/requests/new/NewRequestForm.tsx)과 동일한 값
const REQUIRED_ENVIRONMENT_MAX_LENGTH = 200;
const DATE_ONLY_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

// 참고 영상 링크는 대략적인 URL 형태만 검증한다 - 특정 플랫폼 화이트리스트는 두지 않는다.
export function isValidHttpUrl(value: string): boolean {
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
export function getKstDeadlineBounds(): { min: string; max: string } {
  const kstNow = new Date(Date.now() + 9 * 60 * 60 * 1000);
  const min = kstNow.toISOString().slice(0, 10);
  const kstMax = new Date(kstNow.getTime());
  kstMax.setUTCMonth(kstMax.getUTCMonth() + 6);
  const max = kstMax.toISOString().slice(0, 10);
  return { min, max };
}

// 의뢰 이미지 한 장을 검증하고, 최대 변 길이를 유지한 webp로 재인코딩한다.
// 실패 시 에러 메시지 문자열을 반환하고, 성공 시 처리된 버퍼를 반환한다.
export async function processRequestImage(
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

export type ParsedToolRequestFields = {
  title: string;
  description: string;
  budgetAmount: number | null;
  budgetNegotiable: boolean;
  desiredDeadline: string | null;
  requiredEnvironment: string;
  referenceVideoUrl: string | null;
};

// title/description/budget/desiredDeadline/requiredEnvironment/referenceVideoUrl
// 텍스트 필드만 검증한다(이미지는 각 라우트가 개수 요건이 달라 별도 처리).
export function validateToolRequestFields(
  formData: FormData
): { error: string } | { fields: ParsedToolRequestFields } {
  const title = String(formData.get("title") ?? "").trim();
  const description = String(formData.get("description") ?? "").trim();
  const budgetAmountRaw = formData.get("budgetAmount");
  const budgetNegotiable = formData.get("budgetNegotiable") === "on";
  const desiredDeadlineRaw = formData.get("desiredDeadline");
  const requiredEnvironmentRaw = formData.get("requiredEnvironment");
  const referenceVideoUrlRaw = formData.get("referenceVideoUrl");

  if (title.length < TITLE_MIN_LENGTH) {
    return { error: `제목은 ${TITLE_MIN_LENGTH}자 이상 입력해주세요.` };
  }
  if (description.length < CONTENT_MIN_LENGTH) {
    return { error: `내용은 ${CONTENT_MIN_LENGTH}자 이상 입력해주세요.` };
  }

  const budgetAmountProvided = typeof budgetAmountRaw === "string" && budgetAmountRaw.trim() !== "";
  if (!budgetAmountProvided && !budgetNegotiable) {
    return { error: "예산 금액을 입력하시거나 '협의 가능'에 체크해주세요." };
  }

  let budgetAmount: number | null = null;
  if (budgetAmountProvided) {
    const parsed = Number(budgetAmountRaw);
    if (!Number.isFinite(parsed) || parsed < 0) {
      return { error: "예산은 0 이상의 숫자로 입력해주세요." };
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
      return { error: "희망 완료 시점은 오늘부터 6개월 이내로 선택해주세요." };
    }
  }

  const requiredEnvironment =
    typeof requiredEnvironmentRaw === "string" && requiredEnvironmentRaw.trim() !== ""
      ? requiredEnvironmentRaw.trim()
      : null;
  if (requiredEnvironment === null) {
    return { error: "필요한 프로그램/환경을 하나 이상 선택해주세요." };
  }
  if (requiredEnvironment.length > REQUIRED_ENVIRONMENT_MAX_LENGTH) {
    return { error: `필요한 프로그램/환경은 ${REQUIRED_ENVIRONMENT_MAX_LENGTH}자 이하로 입력해주세요.` };
  }

  let referenceVideoUrl: string | null = null;
  if (typeof referenceVideoUrlRaw === "string" && referenceVideoUrlRaw.trim() !== "") {
    const trimmed = referenceVideoUrlRaw.trim();
    if (!isValidHttpUrl(trimmed)) {
      return { error: "참고 영상 링크 형식이 올바르지 않습니다." };
    }
    referenceVideoUrl = trimmed;
  }

  return {
    fields: {
      title,
      description,
      budgetAmount,
      budgetNegotiable,
      desiredDeadline,
      requiredEnvironment,
      referenceVideoUrl,
    },
  };
}
