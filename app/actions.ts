"use server";

import { notFound, redirect } from "next/navigation";
import { randomUUID } from "node:crypto";
import { del, put } from "@vercel/blob";
import {
  countPurchasesForListing,
  createDraftListing,
  deleteListing,
  getListingDeliveryFileUrlForOwner,
  getListingForOwner,
  getSellerById,
  getSellerSettlementAccount,
  hasConfirmedDeliveryForRequest,
  isDeliveryDraftListing,
  publishListing,
  saveScanReport,
  updateListingDeliveryFile,
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

// app/authActions.ts의 signupAction과 같은 패턴(useActionState) - 유효성
// 검증 실패(제목/가격/카테고리/정산계좌/소스 형식/GitHub·zip 오류)는 서버
// 오류(throw→500)가 아니라 화면에 보여줄 메시지다. 로그인/이메일인증 같은
// 권한성 확인(requireVerifiedSellerId)은 그대로 throw로 남겨둔다 - try 블록
// 밖에서 먼저 끝나므로 이 catch에 걸리지 않는다(요청 범위 밖).
export type CreateListingState = { error?: string };

export async function createListingAction(
  _prevState: CreateListingState,
  formData: FormData
): Promise<CreateListingState> {
  const sellerId = await requireVerifiedSellerId();

  let redirectPath: string;
  try {
    const title = String(formData.get("title") ?? "").trim();
    const description = String(formData.get("description") ?? "").trim();
    const category = String(formData.get("category") ?? "");
    const isFree = String(formData.get("pricingType") ?? "") === "free";
    const price = isFree ? 0 : Number(formData.get("price"));

    if (!title || !description) {
      throw new Error("제목과 설명은 필수입니다.");
    }
    if (!isFree && (!Number.isFinite(price) || price <= 0)) {
      throw new Error("가격을 올바르게 입력해주세요.");
    }
    if (!CATEGORIES.includes(category as Category)) {
      throw new Error("카테고리를 선택해주세요.");
    }

    // 유료 매물은 정산계좌가 먼저 등록되어 있어야 한다 - 등록 폼(PriceField)도
    // 안내를 보여주지만, 폼을 우회한 직접 POST를 막기 위해 서버에서도 다시 막는다.
    if (!isFree) {
      const settlementAccount = await getSellerSettlementAccount(sellerId);
      const hasSettlementAccount =
        !!settlementAccount?.bankName &&
        !!settlementAccount.accountHolder &&
        !!settlementAccount.accountNumber;
      if (!hasSettlementAccount) {
        throw new Error("유료 매물을 등록하려면 먼저 정산계좌를 등록해야 합니다.");
      }
    }

    const sourceType = await parseSourceType(formData);
    // 유료 매물은 결제 완료 후 구매자에게 전달할 파일이 있어야 한다 - 공개
    // 저장소 링크만으로는 결제로 얻는 게 없다. 클라이언트(SourceTypeFields)도
    // zip으로 강제하지만 폼 우회를 막기 위해 서버에서도 다시 확인한다.
    if (!isFree && sourceType !== "zip") {
      throw new Error("유료 매물은 zip 파일 업로드로만 등록할 수 있습니다.");
    }

    const { files, codeUrl, zipBuffer } = await collectFilesForSource(sourceType, formData);

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

    // 유료 매물은 스캔한 바로 그 zip을 private Blob에 보관해 결제 완료 후
    // 구매자에게 전달한다(app/requestActions.ts storeDeliveryFileIfZip과 같은 방식).
    if (!isFree && zipBuffer) {
      const blob = await put(`listing-deliveries/${listing.id}/${randomUUID()}.zip`, zipBuffer, {
        access: "private",
        contentType: "application/zip",
      });
      await updateListingDeliveryFile(listing.id, blob.url);
    }

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
      redirectPath = `/listings/${listing.id}`;
    } else {
      redirectPath = `/listings/${listing.id}/review`;
    }
  } catch (error) {
    if (error instanceof Error) {
      return { error: error.message };
    }
    throw error;
  }

  redirect(redirectPath);
}

export async function rescanListingAction(
  _prevState: CreateListingState,
  formData: FormData
): Promise<CreateListingState> {
  const listingId = String(formData.get("listingId") ?? "");
  const sellerId = await requireSellerId();

  const listing = await getListingForOwner(listingId, sellerId);
  if (!listing) {
    notFound();
  }

  let redirectPath: string;
  try {
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
      redirectPath = `/listings/${listingId}`;
    } else {
      redirectPath = `/listings/${listingId}/review`;
    }
  } catch (error) {
    if (error instanceof Error) {
      return { error: error.message };
    }
    throw error;
  }

  redirect(redirectPath);
}

export async function publishAnywayAction(formData: FormData) {
  const listingId = String(formData.get("listingId") ?? "");
  const disclosureNote = String(formData.get("disclosureNote") ?? "").trim();
  const sellerId = await requireSellerId();

  const published = await publishListing(listingId, sellerId, disclosureNote || null);
  if (!published) {
    notFound();
  }

  redirect(`/listings/${listingId}`);
}

export type DeleteListingState = { error?: string };

export async function deleteListingAction(
  _prevState: DeleteListingState,
  formData: FormData
): Promise<DeleteListingState> {
  const listingId = String(formData.get("listingId") ?? "");
  const sellerId = await requireSellerId();

  const listing = await getListingForOwner(listingId, sellerId);
  if (!listing) {
    notFound();
  }

  const purchaseCount = await countPurchasesForListing(listingId);
  if (purchaseCount > 0) {
    return { error: "구매 기록이 있는 매물은 삭제할 수 없습니다." };
  }

  // UI(매물 상세)는 published=true인 매물만 보여주므로 납품용 draft가 이
  // 화면에 뜰 일이 없지만, 폼 우회(직접 POST)를 막기 위해 서버에서도 다시
  // 확인한다 - publishListing과 동일한 조건을 재사용한다(새 컬럼 없음).
  const isDraft = await isDeliveryDraftListing(listingId);
  if (isDraft) {
    return { error: "납품용 완성본은 이 화면에서 삭제할 수 없습니다." };
  }

  const deliveryFileUrl = await getListingDeliveryFileUrlForOwner(listingId, sellerId);
  if (deliveryFileUrl) {
    await del(deliveryFileUrl);
  }
  await deleteListing(listingId);

  redirect("/listings");
}
