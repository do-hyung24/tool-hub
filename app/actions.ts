"use server";

import { redirect } from "next/navigation";
import {
  createDraftListing,
  getListingForOwner,
  getSellerById,
  hasConfirmedDeliveryForRequest,
  publishListing,
  saveScanReport,
  updateListingSource,
} from "@/lib/data";
import { getCurrentSellerId } from "@/lib/session";
import { fetchGithubScannableFiles, GithubFetchError } from "@/lib/scan";
import { extractScannableFiles, MAX_ZIP_UPLOAD_BYTES, ZipValidationError } from "@/lib/zipExtract";
import { runScan } from "@/lib/scanEngine";
import { RULE_ENGINE_VERSION } from "@/lib/detector";
import { CATEGORIES, SOURCE_TYPES, type Category, type SourceType } from "@/lib/types";
import type { ScannableFile } from "@/lib/scannableFile";

export async function collectFilesForSource(
  sourceType: SourceType,
  formData: FormData
): Promise<{ files: ScannableFile[]; codeUrl: string | null; zipBuffer: Buffer | null }> {
  if (sourceType === "github") {
    const codeUrl = String(formData.get("codeUrl") ?? "").trim();
    if (!codeUrl) {
      throw new Error("GitHub 저장소 링크를 입력해주세요.");
    }
    try {
      const files = await fetchGithubScannableFiles(codeUrl);
      return { files, codeUrl, zipBuffer: null };
    } catch (error) {
      if (error instanceof GithubFetchError) throw new Error(error.message);
      throw error;
    }
  }

  const zipFile = formData.get("zipFile");
  if (!(zipFile instanceof File) || zipFile.size === 0) {
    throw new Error("zip 파일을 선택해주세요.");
  }
  if (zipFile.size > MAX_ZIP_UPLOAD_BYTES) {
    throw new Error(`zip 파일은 최대 ${MAX_ZIP_UPLOAD_BYTES / 1024 / 1024}MB까지 업로드할 수 있습니다.`);
  }

  try {
    const buffer = Buffer.from(await zipFile.arrayBuffer());
    const files = await extractScannableFiles(buffer);
    // 원본 zip 버퍼를 그대로 반환한다 - 마켓 매물 흐름(app/actions.ts 내 다른
    // 호출부)은 이 값을 쓰지 않고, 완성본 납품 흐름(app/requestActions.ts)만
    // private Blob에 저장해 "스캔받은 바로 그 파일"을 다운로드로 제공한다.
    return { files, codeUrl: null, zipBuffer: buffer };
  } catch (error) {
    if (error instanceof ZipValidationError) throw new Error(error.message);
    throw error;
  }
}

// "use server" 파일에서는 async 함수만 export할 수 있으므로(Next 컴파일러 제약),
// app/requestActions.ts에서 재사용하기 위해 export하면서 async로 바꾼다. 호출부가
// 전부 async 함수 안이라 동작은 그대로다.
export async function parseSourceType(formData: FormData): Promise<SourceType> {
  const raw = String(formData.get("sourceType") ?? "");
  if (!SOURCE_TYPES.includes(raw as SourceType)) {
    throw new Error("코드 입력 방식을 선택해주세요.");
  }
  return raw as SourceType;
}

// UI(페이지 단의 리다이렉트)와 별개로, 서버 액션은 직접 POST될 수도 있으므로
// 로그인/권한 검증을 여기서도 반드시 다시 한다.
async function requireSellerId(): Promise<string> {
  const sellerId = await getCurrentSellerId();
  if (!sellerId) {
    throw new Error("로그인이 필요합니다.");
  }
  const seller = await getSellerById(sellerId);
  if (seller?.deletionRequestedAt) {
    throw new Error("탈퇴 처리 중인 계정입니다.");
  }
  return sellerId;
}

async function requireVerifiedSellerId(): Promise<string> {
  const sellerId = await requireSellerId();
  const seller = await getSellerById(sellerId);
  if (!seller?.emailVerified) {
    throw new Error("이메일 인증이 필요합니다.");
  }
  return sellerId;
}

export async function createListingAction(formData: FormData) {
  const title = String(formData.get("title") ?? "").trim();
  const description = String(formData.get("description") ?? "").trim();
  const price = Number(formData.get("price"));
  const category = String(formData.get("category") ?? "");

  if (!title || !description) {
    throw new Error("제목과 설명은 필수입니다.");
  }
  if (!Number.isFinite(price) || price < 0) {
    throw new Error("가격을 올바르게 입력해주세요.");
  }
  if (!CATEGORIES.includes(category as Category)) {
    throw new Error("카테고리를 선택해주세요.");
  }

  const sourceType = await parseSourceType(formData);
  const { files, codeUrl } = await collectFilesForSource(sourceType, formData);
  const sellerId = await requireVerifiedSellerId();

  // 클라이언트가 보낸 sourceRequestId는 그대로 신뢰하지 않는다(IDOR 방지).
  // 이 판매자가 실제로 해당 의뢰를 납품 완료한 경우에만 매물-의뢰를 연결한다.
  const rawSourceRequestId = String(formData.get("sourceRequestId") ?? "").trim();
  const sourceRequestId =
    rawSourceRequestId && (await hasConfirmedDeliveryForRequest(sellerId, rawSourceRequestId))
      ? rawSourceRequestId
      : null;

  const listing = await createDraftListing({
    title,
    description,
    price,
    category: category as Category,
    codeUrl,
    sourceType,
    sellerId,
    sourceRequestId,
  });

  const findings = await runScan(files);
  const report = await saveScanReport({
    listingId: listing.id,
    authorId: sellerId,
    findings,
    ruleEngineVersion: RULE_ENGINE_VERSION,
  });

  const hasUnresolvedFindings = report.findings.some((finding) =>
    ["critical", "high", "medium"].includes(finding.severity)
  );

  if (!hasUnresolvedFindings) {
    await publishListing(listing.id, sellerId, null);
    redirect(`/listings/${listing.id}`);
  }

  redirect(`/listings/${listing.id}/review`);
}

export async function rescanListingAction(formData: FormData) {
  const listingId = String(formData.get("listingId") ?? "");
  const sellerId = await requireSellerId();

  const listing = await getListingForOwner(listingId, sellerId);
  if (!listing) {
    throw new Error("매물을 찾을 수 없거나 접근 권한이 없습니다.");
  }

  const sourceType = await parseSourceType(formData);
  const { files, codeUrl } = await collectFilesForSource(sourceType, formData);

  await updateListingSource(listingId, { codeUrl, sourceType });

  const findings = await runScan(files);
  const report = await saveScanReport({
    listingId,
    authorId: sellerId,
    findings,
    ruleEngineVersion: RULE_ENGINE_VERSION,
  });

  const hasUnresolvedFindings = report.findings.some((finding) =>
    ["critical", "high", "medium"].includes(finding.severity)
  );

  if (!hasUnresolvedFindings) {
    await publishListing(listingId, sellerId, null);
    redirect(`/listings/${listingId}`);
  }

  redirect(`/listings/${listingId}/review`);
}

export async function publishAnywayAction(formData: FormData) {
  const listingId = String(formData.get("listingId") ?? "");
  const disclosureNote = String(formData.get("disclosureNote") ?? "").trim();
  const sellerId = await requireSellerId();

  const published = await publishListing(listingId, sellerId, disclosureNote || null);
  if (!published) {
    throw new Error("매물을 찾을 수 없거나 접근 권한이 없습니다.");
  }

  redirect(`/listings/${listingId}`);
}
