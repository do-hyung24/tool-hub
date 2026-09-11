import "server-only";
import { createHash, randomBytes, randomUUID } from "node:crypto";
import { ensureInitialized, getSql } from "./db";
import { groupFindingsForBuyer } from "./findingCategories";
import type { PublicFindingGroup } from "./findingCategories";
import { BLOCKING_SEVERITIES } from "./types";
import { SUPPORT_EMAIL } from "./constants";
import type {
  Category,
  CommunityCategory,
  CommunityComment,
  CommunityCommentWithAuthor,
  CommunityPost,
  CommunityPostWithAuthor,
  FeedbackCategory,
  FeedbackVoice,
  Finding,
  Listing,
  ScanReport,
  Seller,
  SellerPublicProfile,
  SourceType,
  ToolProposal,
  ToolProposalMessage,
  ToolProposalMessageWithAuthor,
  ToolProposalStatus,
  ToolProposalWithAuthor,
  ToolRequest,
  ToolRequestImage,
  ToolRequestStatus,
  ToolRequestWithAuthor,
} from "./types";

type ListingRow = {
  id: string;
  title: string;
  description: string;
  price: number;
  category: string;
  code_url: string | null;
  source_type: string;
  published: boolean;
  scan_status: string;
  disclosure_note: string | null;
  has_unresolved_findings: boolean;
  created_at: string;
  seller_id: string;
  source_request_id: string | null;
};

type ScanReportRow = {
  id: string;
  listing_id: string;
  author_id: string;
  findings: Finding[];
  rule_engine_version: string;
  created_at: string;
};

type SellerRow = {
  id: string;
  nickname: string;
  contact: string;
  email: string | null;
  email_verified: boolean;
  deletion_requested_at: string | null;
  profile_image_url: string | null;
  created_at: string;
};

function rowToListing(row: ListingRow): Listing {
  return {
    id: row.id,
    title: row.title,
    description: row.description,
    price: row.price,
    category: row.category as Category,
    codeUrl: row.code_url,
    sourceType: row.source_type as SourceType,
    published: row.published,
    scanStatus: row.scan_status as Listing["scanStatus"],
    disclosureNote: row.disclosure_note,
    hasUnresolvedFindings: row.has_unresolved_findings,
    createdAt: row.created_at,
    sellerId: row.seller_id,
    sourceRequestId: row.source_request_id,
  };
}

function rowToScanReport(row: ScanReportRow): ScanReport {
  return {
    id: row.id,
    listingId: row.listing_id,
    authorId: row.author_id,
    findings: row.findings,
    createdAt: row.created_at,
    ruleEngineVersion: row.rule_engine_version,
  };
}

function rowToSeller(row: SellerRow): Seller {
  return {
    id: row.id,
    nickname: row.nickname,
    contact: row.contact,
    email: row.email,
    emailVerified: row.email_verified,
    deletionRequestedAt: row.deletion_requested_at,
    profileImageUrl: row.profile_image_url ?? null,
    createdAt: row.created_at,
  };
}

// 공개 매물 목록 - 게시(published)된 것만 노출한다. 탈퇴 처리 중인(deletion_requested_at이
// 설정된) 판매자의 매물은 즉시 비공개 처리한다.
export async function getListings(): Promise<Listing[]> {
  await ensureInitialized();
  const sql = getSql();
  const rows = (await sql`
    SELECT listings.*
    FROM listings
    JOIN sellers ON sellers.id = listings.seller_id
    WHERE listings.published = true AND sellers.deletion_requested_at IS NULL
    ORDER BY listings.created_at DESC
  `) as ListingRow[];
  return rows.map(rowToListing);
}

// 공개 상세 페이지용 - 게시되지 않은(작성자 검토 중) 매물은 존재 자체를 숨긴다.
// getListings()와 동일하게 탈퇴 처리 중인 판매자의 매물도 숨긴다.
export async function getListingById(id: string): Promise<Listing | null> {
  await ensureInitialized();
  const sql = getSql();
  const rows = (await sql`
    SELECT listings.*
    FROM listings
    JOIN sellers ON sellers.id = listings.seller_id
    WHERE listings.id = ${id} AND listings.published = true AND sellers.deletion_requested_at IS NULL
  `) as ListingRow[];
  return rows[0] ? rowToListing(rows[0]) : null;
}

// 작성자 본인 전용 조회 - 게시 여부와 무관하게 자신의 매물은 볼 수 있다.
// 소유자가 아니면 null을 반환해 "존재하지 않음"과 동일하게 처리한다 (IDOR 방지).
export async function getListingForOwner(
  id: string,
  sellerId: string
): Promise<Listing | null> {
  await ensureInitialized();
  const sql = getSql();
  const rows = (await sql`
    SELECT * FROM listings WHERE id = ${id} AND seller_id = ${sellerId}
  `) as ListingRow[];
  return rows[0] ? rowToListing(rows[0]) : null;
}

export async function getSellerById(id: string): Promise<Seller | null> {
  await ensureInitialized();
  const sql = getSql();
  const rows = (await sql`
    SELECT id, nickname, contact, email, email_verified, deletion_requested_at, profile_image_url, created_at
    FROM sellers WHERE id = ${id}
  `) as SellerRow[];
  return rows[0] ? rowToSeller(rows[0]) : null;
}

export async function getSellerByEmail(email: string): Promise<Seller | null> {
  await ensureInitialized();
  const sql = getSql();
  const rows = (await sql`
    SELECT id, nickname, contact, email, email_verified, profile_image_url, created_at
    FROM sellers WHERE email = ${email.trim().toLowerCase()}
  `) as SellerRow[];
  return rows[0] ? rowToSeller(rows[0]) : null;
}

export async function getSellerByNickname(nickname: string): Promise<Seller | null> {
  await ensureInitialized();
  const sql = getSql();
  const rows = (await sql`
    SELECT id, nickname, contact, email, email_verified, profile_image_url, created_at
    FROM sellers WHERE nickname = ${nickname.trim()}
  `) as SellerRow[];
  return rows[0] ? rowToSeller(rows[0]) : null;
}

// /sellers/[id] 공개 프로필용 집계. 이메일 등 비공개 정보는 반환 객체를 새로
// 조립해서(...seller 스프레드 없이) 절대 포함하지 않는다. 탈퇴 처리 중인
// 계정은 공개 매물과 동일한 기준으로 존재 자체를 숨긴다(null 반환).
export async function getSellerPublicProfile(sellerId: string): Promise<SellerPublicProfile | null> {
  await ensureInitialized();
  const sql = getSql();

  const seller = await getSellerById(sellerId);
  if (!seller || seller.deletionRequestedAt) {
    return null;
  }

  const [deliveryRows, listingRows] = await Promise.all([
    sql`
      SELECT
        COUNT(*)::int AS total,
        COUNT(*) FILTER (WHERE listings.has_unresolved_findings = false)::int AS passed
      FROM tool_proposals
      JOIN tool_requests ON tool_requests.id = tool_proposals.request_id
      JOIN listings ON listings.id = tool_proposals.delivered_listing_id
      WHERE tool_proposals.seller_id = ${sellerId}
        AND tool_proposals.status = 'selected'
        AND tool_requests.status = 'completed'
    `,
    sql`
      SELECT id, title, scan_status
      FROM listings
      WHERE seller_id = ${sellerId} AND published = true
      ORDER BY created_at DESC
    `,
  ]);

  const { total, passed } = (deliveryRows as Array<{ total: number; passed: number }>)[0] ?? {
    total: 0,
    passed: 0,
  };

  return {
    sellerId,
    nickname: seller.nickname,
    profileImageUrl: seller.profileImageUrl,
    createdAt: seller.createdAt,
    completedAsMaker: total,
    scanPassRate: total > 0 ? passed / total : null,
    publishedListings: (
      listingRows as Array<{ id: string; title: string; scan_status: string }>
    ).map((row) => ({
      id: row.id,
      title: row.title,
      scanStatus: row.scan_status as Listing["scanStatus"],
    })),
  };
}

// 회원가입으로 새 판매자 계정을 만든다. 연락처(contact)는 아직 별도 입력을 받지
// 않으므로 우선 이메일을 기본값으로 채워두고, 프로필 수정 기능은 이후 과제로 남긴다.
export async function createSeller(input: {
  email: string;
  passwordHash: string;
  nickname: string;
}): Promise<Seller> {
  await ensureInitialized();
  const sql = getSql();

  const seller: Seller = {
    id: randomUUID(),
    nickname: input.nickname,
    contact: input.email,
    email: input.email.trim().toLowerCase(),
    emailVerified: false,
    deletionRequestedAt: null,
    profileImageUrl: null,
    createdAt: new Date().toISOString(),
  };

  await sql`
    INSERT INTO sellers (id, nickname, contact, email, password_hash, email_verified, created_at)
    VALUES (
      ${seller.id}, ${seller.nickname}, ${seller.contact},
      ${seller.email}, ${input.passwordHash}, false, ${seller.createdAt}
    )
  `;

  return seller;
}

export async function markSellerEmailVerified(sellerId: string): Promise<void> {
  await ensureInitialized();
  const sql = getSql();
  await sql`UPDATE sellers SET email_verified = true WHERE id = ${sellerId}`;
}

// 프로필 사진 URL을 갱신한다. 호출부(API 라우트)에서 기존 profile_image_url을
// 먼저 조회해 Blob에서 이전 파일을 삭제한 뒤 이 함수로 새 URL을 반영해야 한다.
export async function updateSellerProfileImage(
  sellerId: string,
  profileImageUrl: string
): Promise<void> {
  await ensureInitialized();
  const sql = getSql();
  await sql`UPDATE sellers SET profile_image_url = ${profileImageUrl} WHERE id = ${sellerId}`;
}

const VERIFICATION_TTL_MS = 15 * 60 * 1000; // 15분 - 직접 입력하는 코드라 짧게 잡는다.
const MAX_CODE_ATTEMPTS = 5;

function generateSixDigitCode(): string {
  return String(Math.floor(Math.random() * 1_000_000)).padStart(6, "0");
}

const RESEND_COOLDOWN_MS = 60 * 1000; // 직전 발송으로부터 1분이 지나야 다음 발송 가능

export type ResendVerificationResult =
  | { status: "ok"; token: string; code: string; nextAllowedAt: number }
  | { status: "rate_limited"; retryAfterMs: number };

// 인증 코드 발송/재발송 전용 - 최초 발송과 재발송을 구분하지 않고 동일하게
// 처리한다(이 사이클의 "최초 발송"은 last_sent_at이 아직 없는 상태에서의
// 호출일 뿐이다). 이전에 발급된 토큰/코드는 매 호출마다 무효화되고 새로
// 발급된다.
//
// 쿨다운 통과 여부 판단과 last_sent_at 갱신을 하나의 UPDATE로 묶어 원자적으로
// 처리한다 - 더블클릭/여러 탭에서 거의 동시에 들어온 요청이 둘 다 갱신 전
// 값을 읽고 통과해버리는 레이스를 막기 위함이다. WHERE 절의 조건을 만족하는
// 행만 실제로 갱신되므로, 영향받은 행이 없으면(=조건 불만족) 그 시점의 최신
// 상태를 다시 읽어 재시도 가능 시각을 계산한다.
export async function createResendVerificationToken(
  sellerId: string
): Promise<ResendVerificationResult> {
  await ensureInitialized();
  const sql = getSql();

  const token = randomUUID();
  const code = generateSixDigitCode();
  const now = Date.now();
  const nowIso = new Date(now).toISOString();
  const expiresAt = new Date(now + VERIFICATION_TTL_MS).toISOString();
  const cutoffIso = new Date(now - RESEND_COOLDOWN_MS).toISOString();

  const updated = (await sql`
    UPDATE email_verification_tokens
    SET token = ${token}, code = ${code}, attempts = 0, expires_at = ${expiresAt},
        created_at = ${nowIso}, last_sent_at = ${nowIso}
    WHERE seller_id = ${sellerId}
      AND (last_sent_at IS NULL OR last_sent_at <= ${cutoffIso})
    RETURNING token
  `) as Array<{ token: string }>;

  if (updated[0]) {
    return { status: "ok", token, code, nextAllowedAt: now + RESEND_COOLDOWN_MS };
  }

  // WHERE 조건에 걸려 갱신되지 않은 경우 - 쿨다운 중인지, 아니면 애초에 활성
  // 토큰 행이 없는지(예: 만료된 코드 입력으로 행이 삭제된 뒤) 구분해야 한다.
  const rows = (await sql`
    SELECT last_sent_at FROM email_verification_tokens WHERE seller_id = ${sellerId}
  `) as Array<{ last_sent_at: string | null }>;
  const prior = rows[0];

  if (prior?.last_sent_at) {
    const elapsed = Date.now() - new Date(prior.last_sent_at).getTime();
    if (elapsed < RESEND_COOLDOWN_MS) {
      return { status: "rate_limited", retryAfterMs: RESEND_COOLDOWN_MS - elapsed };
    }
  }

  // 활성 토큰 행 자체가 없다 - 새 인증 사이클로 취급해 발급한다.
  await sql`
    INSERT INTO email_verification_tokens (token, seller_id, code, attempts, expires_at, created_at, last_sent_at)
    VALUES (${token}, ${sellerId}, ${code}, 0, ${expiresAt}, ${nowIso}, ${nowIso})
  `;
  return { status: "ok", token, code, nextAllowedAt: now + RESEND_COOLDOWN_MS };
}

// /verify-email 페이지 렌더링 시점에 버튼 라벨("발송" vs "재발송")과 남은
// 쿨다운을 서버 기준으로 계산하기 위한 조회. hasSentBefore는 last_sent_at
// 존재 여부로만 판단하며, 발송 성공 후에는 계속 true로 남는다.
export async function getVerificationCooldownState(
  sellerId: string
): Promise<{ hasSentBefore: boolean; nextAllowedAt: number | null }> {
  await ensureInitialized();
  const sql = getSql();

  const rows = (await sql`
    SELECT last_sent_at FROM email_verification_tokens WHERE seller_id = ${sellerId}
  `) as Array<{ last_sent_at: string | null }>;
  const lastSentAt = rows[0]?.last_sent_at ?? null;
  if (!lastSentAt) {
    return { hasSentBefore: false, nextAllowedAt: null };
  }

  const nextAllowedAt = new Date(lastSentAt).getTime() + RESEND_COOLDOWN_MS;
  return { hasSentBefore: true, nextAllowedAt: nextAllowedAt > Date.now() ? nextAllowedAt : null };
}

// 이메일 링크를 클릭했을 때 쓰는 경로. 토큰을 검증하고 1회용으로 소모한다.
export async function consumeEmailVerificationToken(
  token: string
): Promise<string | null> {
  await ensureInitialized();
  const sql = getSql();

  const rows = (await sql`
    SELECT seller_id, expires_at FROM email_verification_tokens WHERE token = ${token}
  `) as Array<{ seller_id: string; expires_at: string }>;
  const record = rows[0];
  if (!record) return null;

  await sql`DELETE FROM email_verification_tokens WHERE token = ${token}`;

  if (new Date(record.expires_at).getTime() < Date.now()) {
    return null;
  }

  await markSellerEmailVerified(record.seller_id);
  return record.seller_id;
}

export type VerifyCodeResult = "ok" | "not_found" | "expired" | "mismatch" | "locked";

// 사용자가 직접 입력한 6자리 코드를 검증한다. 현재 로그인한 세션의 seller_id로만
// 조회하므로, 다른 사람의 인증 코드를 무작위로 시도할 수 없다 (본인 계정으로
// 로그인해야만 이 경로에 닿을 수 있음). 그 위에 실패 횟수 제한도 함께 둔다.
export async function verifyEmailCode(
  sellerId: string,
  submittedCode: string
): Promise<VerifyCodeResult> {
  await ensureInitialized();
  const sql = getSql();

  const rows = (await sql`
    SELECT token, code, attempts, expires_at
    FROM email_verification_tokens
    WHERE seller_id = ${sellerId}
    ORDER BY created_at DESC
    LIMIT 1
  `) as Array<{ token: string; code: string; attempts: number; expires_at: string }>;
  const record = rows[0];
  if (!record) return "not_found";

  if (new Date(record.expires_at).getTime() < Date.now()) {
    await sql`DELETE FROM email_verification_tokens WHERE token = ${record.token}`;
    return "expired";
  }

  if (record.attempts >= MAX_CODE_ATTEMPTS) {
    await sql`DELETE FROM email_verification_tokens WHERE token = ${record.token}`;
    return "locked";
  }

  if (record.code !== submittedCode) {
    await sql`
      UPDATE email_verification_tokens SET attempts = attempts + 1 WHERE token = ${record.token}
    `;
    return record.attempts + 1 >= MAX_CODE_ATTEMPTS ? "locked" : "mismatch";
  }

  await sql`DELETE FROM email_verification_tokens WHERE token = ${record.token}`;
  await markSellerEmailVerified(sellerId);
  return "ok";
}

const RESET_TOKEN_TTL_MS = 60 * 60 * 1000; // 1시간

function hashResetToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

// 비밀번호 재설정 링크에 담을 원문 토큰을 발급한다. DB에는 해시만 저장하고
// 원문은 반환값으로만 내보내(이메일 링크에 넣는 용도), 이 함수를 호출한 쪽이
// 직접 이메일을 보내야 한다. 같은 계정의 미사용 토큰이 남아있으면 먼저 무효화한다.
export async function createPasswordResetToken(sellerId: string): Promise<string> {
  await ensureInitialized();
  const sql = getSql();

  await sql`DELETE FROM password_reset_tokens WHERE seller_id = ${sellerId} AND used_at IS NULL`;

  const token = randomBytes(32).toString("hex");
  const tokenHash = hashResetToken(token);
  const expiresAt = new Date(Date.now() + RESET_TOKEN_TTL_MS).toISOString();
  await sql`
    INSERT INTO password_reset_tokens (token_hash, seller_id, expires_at, created_at)
    VALUES (${tokenHash}, ${sellerId}, ${expiresAt}, ${new Date().toISOString()})
  `;

  return token;
}

export type PasswordResetResult = "ok" | "not_found" | "expired" | "used";

// 토큰(원문)을 해시로 변환해 대조하고, 만료/사용 여부를 확인한 뒤 통과하면
// 비밀번호를 갱신하고 토큰을 1회용으로 소모(used_at 기록)한다.
export async function resetPasswordWithToken(
  token: string,
  newPasswordHash: string
): Promise<PasswordResetResult> {
  await ensureInitialized();
  const sql = getSql();
  const tokenHash = hashResetToken(token);

  const rows = (await sql`
    SELECT seller_id, expires_at, used_at
    FROM password_reset_tokens WHERE token_hash = ${tokenHash}
  `) as Array<{ seller_id: string; expires_at: string; used_at: string | null }>;
  const record = rows[0];
  if (!record) return "not_found";
  if (record.used_at) return "used";
  if (new Date(record.expires_at).getTime() < Date.now()) return "expired";

  await sql`UPDATE sellers SET password_hash = ${newPasswordHash} WHERE id = ${record.seller_id}`;
  await sql`
    UPDATE password_reset_tokens SET used_at = ${new Date().toISOString()} WHERE token_hash = ${tokenHash}
  `;

  return "ok";
}

// 매물을 "미게시(초안)" 상태로 생성한다. 스캔 결과를 작성자가 확인하고
// 게시를 결정하기 전까지는 공개 목록/상세 페이지에 나타나지 않는다.
export async function createDraftListing(input: {
  title: string;
  description: string;
  price: number;
  category: Category;
  codeUrl: string | null;
  sourceType: SourceType;
  sellerId: string;
  sourceRequestId?: string | null;
}): Promise<Listing> {
  await ensureInitialized();
  const sql = getSql();

  const listing: Listing = {
    id: randomUUID(),
    title: input.title,
    description: input.description,
    price: input.price,
    category: input.category,
    codeUrl: input.codeUrl,
    sourceType: input.sourceType,
    published: false,
    scanStatus: "pending",
    disclosureNote: null,
    hasUnresolvedFindings: false,
    createdAt: new Date().toISOString(),
    sellerId: input.sellerId,
    sourceRequestId: input.sourceRequestId ?? null,
  };

  await sql`
    INSERT INTO listings (
      id, title, description, price, category, code_url, source_type,
      published, scan_status, disclosure_note, has_unresolved_findings,
      created_at, seller_id, source_request_id
    )
    VALUES (
      ${listing.id}, ${listing.title}, ${listing.description}, ${listing.price},
      ${listing.category}, ${listing.codeUrl}, ${listing.sourceType},
      ${listing.published}, ${listing.scanStatus}, ${listing.disclosureNote},
      ${listing.hasUnresolvedFindings}, ${listing.createdAt}, ${listing.sellerId},
      ${listing.sourceRequestId}
    )
  `;

  return listing;
}

// 코드 재입력 후 다시 스캔할 때, 매물 본문(코드 출처)을 갱신하고
// 상태를 다시 "스캔 대기"로 되돌린다. 소유자만 호출할 수 있도록
// 호출부(server action)에서 getListingForOwner로 먼저 소유권을 확인해야 한다.
export async function updateListingSource(
  id: string,
  input: { codeUrl: string | null; sourceType: SourceType }
): Promise<void> {
  await ensureInitialized();
  const sql = getSql();
  await sql`
    UPDATE listings
    SET code_url = ${input.codeUrl}, source_type = ${input.sourceType}, scan_status = 'pending'
    WHERE id = ${id}
  `;
}

// 스캔 리포트를 저장하고, 매물의 스캔 상태/미해결 findings 여부를 함께 갱신한다.
export async function saveScanReport(input: {
  listingId: string;
  authorId: string;
  findings: Finding[];
  ruleEngineVersion: string;
}): Promise<ScanReport> {
  await ensureInitialized();
  const sql = getSql();

  const report: ScanReport = {
    id: randomUUID(),
    listingId: input.listingId,
    authorId: input.authorId,
    findings: input.findings,
    ruleEngineVersion: input.ruleEngineVersion,
    createdAt: new Date().toISOString(),
  };

  const hasUnresolvedFindings = input.findings.some((finding) =>
    BLOCKING_SEVERITIES.includes(finding.severity)
  );

  await sql`
    INSERT INTO scan_reports (id, listing_id, author_id, findings, rule_engine_version, created_at)
    VALUES (
      ${report.id}, ${report.listingId}, ${report.authorId},
      ${JSON.stringify(report.findings)}, ${report.ruleEngineVersion}, ${report.createdAt}
    )
  `;

  await sql`
    UPDATE listings
    SET scan_status = 'completed', has_unresolved_findings = ${hasUnresolvedFindings}
    WHERE id = ${input.listingId}
  `;

  return report;
}

// 리포트는 해당 매물의 작성자만 조회할 수 있다. listing_id와 author_id를
// 함께 조건으로 걸어, 다른 사람 소유의 매물 id를 넣어도 결과가 나오지 않는다 (IDOR 방지).
export async function getScanReportForOwner(
  listingId: string,
  requesterId: string
): Promise<ScanReport | null> {
  await ensureInitialized();
  const sql = getSql();
  const rows = (await sql`
    SELECT * FROM scan_reports
    WHERE listing_id = ${listingId} AND author_id = ${requesterId}
    ORDER BY created_at DESC
    LIMIT 1
  `) as ScanReportRow[];
  return rows[0] ? rowToScanReport(rows[0]) : null;
}

// 구매자(누구나)에게 공개하는 스캔 요약. 게시된 매물만 대상으로 하고
// (l.published = true), 판매자 전용 세부 정보(type/filePath/location/
// maskedEvidence/description)는 groupFindingsForBuyer가 애초에 반환하지
// 않으므로 여기서 별도로 지울 필요가 없다.
export async function getPublicScanSummary(listingId: string): Promise<PublicFindingGroup[] | null> {
  await ensureInitialized();
  const sql = getSql();
  const rows = (await sql`
    SELECT sr.findings
    FROM scan_reports sr
    JOIN listings l ON l.id = sr.listing_id
    WHERE sr.listing_id = ${listingId} AND l.published = true
    ORDER BY sr.created_at DESC
    LIMIT 1
  `) as Array<{ findings: Finding[] }>;
  const report = rows[0];
  if (!report) return null;
  return groupFindingsForBuyer(report.findings);
}

// 매물을 게시한다. WHERE 절에 seller_id를 함께 걸어, 소유자가 아니면
// 아무 행도 바뀌지 않도록 한다 (IDOR 방지). 반환값이 null이면 소유자가 아니거나
// 존재하지 않는 매물이라는 뜻이다.
// 추가로, 어떤 제안의 납품물(tool_proposals.delivered_listing_id가 가리키는 행)은
// 그 의뢰자에게만 전달되는 비공개 산출물이므로 절대 published=true가 되면 안 된다 —
// 같은 IDOR 가드 스타일로 WHERE 절에서 막는다(0행 → null 반환). 의뢰 완료 후
// 판매자가 마켓에 재등록하는 경우는 source_request_id만 있고 어떤 제안도 가리키지
// 않는 별개의 새 행이므로 이 조건에 걸리지 않는다.
export async function publishListing(
  id: string,
  sellerId: string,
  disclosureNote: string | null
): Promise<Listing | null> {
  await ensureInitialized();
  const sql = getSql();
  const rows = (await sql`
    UPDATE listings
    SET published = true, disclosure_note = ${disclosureNote}
    WHERE id = ${id} AND seller_id = ${sellerId}
      AND NOT EXISTS (SELECT 1 FROM tool_proposals WHERE delivered_listing_id = listings.id)
    RETURNING *
  `) as ListingRow[];
  return rows[0] ? rowToListing(rows[0]) : null;
}

// 회원 탈퇴를 접수한다. 이미 탈퇴가 예약된 계정이면(WHERE ... deletion_requested_at IS NULL)
// 다시 호출해도 유예 기간 타이머가 재설정되지 않는다 - 버튼을 두 번 눌러도 삭제
// 예정일이 계속 미뤄지는 일이 없도록 하기 위함이다.
export async function requestAccountDeletion(sellerId: string): Promise<void> {
  await ensureInitialized();
  const sql = getSql();
  await sql`
    UPDATE sellers
    SET deletion_requested_at = ${new Date().toISOString()}
    WHERE id = ${sellerId} AND deletion_requested_at IS NULL
  `;
}

export const DELETION_GRACE_PERIOD_MS = 14 * 24 * 60 * 60 * 1000; // 14일

// 순수 함수로 분리해 실제 DB 연결 없이도 경계값(정확히 14일 경과 등)을 테스트할 수 있게 한다.
export function isEligibleForPurge(deletionRequestedAt: string, now: Date = new Date()): boolean {
  const requestedAtMs = new Date(deletionRequestedAt).getTime();
  if (Number.isNaN(requestedAtMs)) {
    console.warn(`[계정 삭제] deletion_requested_at 값을 날짜로 파싱할 수 없습니다: ${deletionRequestedAt}`);
    return false;
  }
  return now.getTime() - requestedAtMs >= DELETION_GRACE_PERIOD_MS;
}

// 탈퇴 유예 기간(14일)이 지난 계정과 그 계정이 등록한 매물 데이터를 완전히(hard delete)
// 삭제한다. FK 제약 때문에 자식 행(scan_reports, listings, 토큰들)부터 먼저 지우고
// 마지막에 sellers 행을 지운다. 이 파일의 다른 다중 쓰기(initialize()의 시드 삽입 등)와
// 동일하게 트랜잭션 없이 순차 실행한다.
export async function purgeExpiredDeletedAccounts(): Promise<{ purgedCount: number }> {
  await ensureInitialized();
  const sql = getSql();

  const rows = (await sql`
    SELECT id, deletion_requested_at FROM sellers WHERE deletion_requested_at IS NOT NULL
  `) as Array<{ id: string; deletion_requested_at: string }>;

  const now = new Date();
  const targets = rows.filter((row) => isEligibleForPurge(row.deletion_requested_at, now));

  let purgedCount = 0;
  for (const target of targets) {
    try {
      await sql`
        DELETE FROM scan_reports
        WHERE listing_id IN (SELECT id FROM listings WHERE seller_id = ${target.id})
           OR author_id = ${target.id}
      `;
      // 의뢰 게시판(tool_requests/tool_proposals/tool_request_images/tool_proposal_messages) 정리.
      // FK가 두 방향으로 얽혀 있다(이 유저가 의뢰자로서 올린 의뢰, 판매자로서 낸 제안/납품) —
      // 두 역할 모두를 자식 → 부모 순서로 지운다.

      // 1) 이 유저 소유 리스팅이 삭제되기 전에, 그 리스팅을 가리키는 delivered_listing_id를 먼저 끊는다.
      //    (delivered_listing_id는 항상 그 제안을 낸 판매자 본인의 리스팅을 가리키므로 seller_id=target인
      //    제안에만 해당한다.)
      await sql`
        UPDATE tool_proposals SET delivered_listing_id = NULL
        WHERE delivered_listing_id IN (SELECT id FROM listings WHERE seller_id = ${target.id})
      `;

      // 2) 이 유저가 의뢰자로 올린 의뢰가 삭제되기 전에, 그 의뢰를 가리키는 listings.source_request_id를
      //    먼저 끊는다. (그 의뢰에 납품한 판매자가 다른 사람이면, 그 판매자의 리스팅 자체는 지우지 않고
      //    참조만 끊는다 — 남의 리스팅을 이 유저 탈퇴 때문에 지워서는 안 된다.)
      await sql`
        UPDATE listings SET source_request_id = NULL
        WHERE source_request_id IN (SELECT id FROM tool_requests WHERE requester_seller_id = ${target.id})
      `;

      // 3) 메시지(자식)부터: 이 유저가 보낸 메시지, 이 유저가 낸 제안에 달린 메시지(발신자 무관),
      //    이 유저의 의뢰에 달린 제안들의 메시지(발신자 무관).
      await sql`DELETE FROM tool_proposal_messages WHERE sender_seller_id = ${target.id}`;
      await sql`
        DELETE FROM tool_proposal_messages
        WHERE proposal_id IN (SELECT id FROM tool_proposals WHERE seller_id = ${target.id})
      `;
      await sql`
        DELETE FROM tool_proposal_messages
        WHERE proposal_id IN (
          SELECT id FROM tool_proposals WHERE request_id IN (
            SELECT id FROM tool_requests WHERE requester_seller_id = ${target.id}
          )
        )
      `;

      // 4) 제안: 이 유저가 낸 제안, 이 유저의 의뢰에 달린 다른 사람의 제안.
      await sql`DELETE FROM tool_proposals WHERE seller_id = ${target.id}`;
      await sql`
        DELETE FROM tool_proposals
        WHERE request_id IN (SELECT id FROM tool_requests WHERE requester_seller_id = ${target.id})
      `;

      // 5) 의뢰 첨부 사진, 의뢰 본문.
      await sql`
        DELETE FROM tool_request_images
        WHERE request_id IN (SELECT id FROM tool_requests WHERE requester_seller_id = ${target.id})
      `;
      await sql`DELETE FROM tool_requests WHERE requester_seller_id = ${target.id}`;
      await sql`DELETE FROM listings WHERE seller_id = ${target.id}`;
      await sql`DELETE FROM email_verification_tokens WHERE seller_id = ${target.id}`;
      await sql`DELETE FROM password_reset_tokens WHERE seller_id = ${target.id}`;
      await sql`DELETE FROM feedback_voices WHERE seller_id = ${target.id}`;
      // 커뮤니티: 이 유저가 남긴 신고 → 이 유저의 댓글에 달린 신고 → 이 유저의 댓글 →
      // 이 유저 글에 달린 다른 사람 댓글 → 이 유저 글에 대한 신고 → 이 유저의 글, 순서로
      // 자식부터 지운다 (FK 제약 순서 준수).
      await sql`DELETE FROM community_comment_reports WHERE reporter_seller_id = ${target.id}`;
      await sql`
        DELETE FROM community_comment_reports
        WHERE comment_id IN (SELECT id FROM community_comments WHERE author_seller_id = ${target.id})
      `;
      await sql`DELETE FROM community_comments WHERE author_seller_id = ${target.id}`;
      await sql`
        DELETE FROM community_comments
        WHERE post_id IN (SELECT id FROM community_posts WHERE author_seller_id = ${target.id})
      `;
      await sql`DELETE FROM community_post_reports WHERE reporter_seller_id = ${target.id}`;
      await sql`
        DELETE FROM community_post_reports
        WHERE post_id IN (SELECT id FROM community_posts WHERE author_seller_id = ${target.id})
      `;
      await sql`DELETE FROM community_posts WHERE author_seller_id = ${target.id}`;
      await sql`DELETE FROM sellers WHERE id = ${target.id}`;
      purgedCount += 1;
    } catch (error) {
      // 한 계정 삭제가 실패해도 나머지 계정 처리는 계속한다. 실패한 계정은
      // deletion_requested_at이 그대로 남아있으므로 다음날 재시도된다.
      console.error(`[계정 영구 삭제] seller ${target.id} 삭제 실패:`, error);
    }
  }

  return { purgedCount };
}

type FeedbackVoiceRow = {
  id: string;
  seller_id: string;
  category: string;
  message: string;
  created_at: string;
};

function rowToFeedbackVoice(row: FeedbackVoiceRow): FeedbackVoice {
  return {
    id: row.id,
    sellerId: row.seller_id,
    category: row.category as FeedbackCategory,
    message: row.message,
    createdAt: row.created_at,
  };
}

// 스팸 방지(60초 재요청 제한) 판단에 쓴다 - 호출부에서 createdAt과 현재 시각을 비교한다.
export async function getLatestFeedbackVoice(sellerId: string): Promise<FeedbackVoice | null> {
  await ensureInitialized();
  const sql = getSql();
  const rows = (await sql`
    SELECT * FROM feedback_voices WHERE seller_id = ${sellerId}
    ORDER BY created_at DESC
    LIMIT 1
  `) as FeedbackVoiceRow[];
  return rows[0] ? rowToFeedbackVoice(rows[0]) : null;
}

export async function createFeedbackVoice(input: {
  sellerId: string;
  category: FeedbackCategory;
  message: string;
}): Promise<FeedbackVoice> {
  await ensureInitialized();
  const sql = getSql();

  const feedback: FeedbackVoice = {
    id: randomUUID(),
    sellerId: input.sellerId,
    category: input.category,
    message: input.message,
    createdAt: new Date().toISOString(),
  };

  await sql`
    INSERT INTO feedback_voices (id, seller_id, category, message, created_at)
    VALUES (${feedback.id}, ${feedback.sellerId}, ${feedback.category}, ${feedback.message}, ${feedback.createdAt})
  `;

  return feedback;
}

// 커뮤니티 '공지' 카테고리는 이 계정(SUPPORT_EMAIL로 가입된 운영자 seller)만 쓸 수 있다.
// 고정된 seller_id 대신 이메일로 판단해, 운영자 계정이 재생성돼도 코드 변경 없이 동작한다.
export async function isOperatorSeller(sellerId: string): Promise<boolean> {
  const seller = await getSellerById(sellerId);
  return seller?.email === SUPPORT_EMAIL;
}

type CommunityPostRow = {
  id: string;
  author_seller_id: string;
  category: string;
  title: string;
  content: string;
  hidden: boolean;
  created_at: string;
  author_nickname: string;
  author_profile_image_url: string | null;
};

function rowToCommunityPostWithAuthor(row: CommunityPostRow): CommunityPostWithAuthor {
  return {
    id: row.id,
    authorSellerId: row.author_seller_id,
    category: row.category as CommunityCategory,
    title: row.title,
    content: row.content,
    hidden: row.hidden,
    createdAt: row.created_at,
    authorNickname: row.author_nickname,
    authorProfileImageUrl: row.author_profile_image_url,
  };
}

export async function createCommunityPost(input: {
  authorSellerId: string;
  category: CommunityCategory;
  title: string;
  content: string;
}): Promise<CommunityPost> {
  await ensureInitialized();
  const sql = getSql();

  const post: CommunityPost = {
    id: randomUUID(),
    authorSellerId: input.authorSellerId,
    category: input.category,
    title: input.title,
    content: input.content,
    hidden: false,
    createdAt: new Date().toISOString(),
  };

  await sql`
    INSERT INTO community_posts (id, author_seller_id, category, title, content, hidden, created_at)
    VALUES (
      ${post.id}, ${post.authorSellerId}, ${post.category}, ${post.title},
      ${post.content}, ${post.hidden}, ${post.createdAt}
    )
  `;

  return post;
}

// hidden=false인 글만 노출한다 (신고 누적으로 자동 숨김된 글 제외).
export async function listCommunityPosts(input: {
  category: CommunityCategory | null;
  page: number;
  pageSize: number;
}): Promise<{ posts: CommunityPostWithAuthor[]; total: number }> {
  await ensureInitialized();
  const sql = getSql();
  const offset = (input.page - 1) * input.pageSize;

  const [rows, countRows] = input.category
    ? await Promise.all([
        sql`
          SELECT community_posts.*, sellers.nickname AS author_nickname,
                 sellers.profile_image_url AS author_profile_image_url
          FROM community_posts
          JOIN sellers ON sellers.id = community_posts.author_seller_id
          WHERE community_posts.hidden = false AND community_posts.category = ${input.category}
          ORDER BY community_posts.created_at DESC
          LIMIT ${input.pageSize} OFFSET ${offset}
        `,
        sql`
          SELECT COUNT(*) AS count FROM community_posts
          WHERE hidden = false AND category = ${input.category}
        `,
      ])
    : await Promise.all([
        sql`
          SELECT community_posts.*, sellers.nickname AS author_nickname,
                 sellers.profile_image_url AS author_profile_image_url
          FROM community_posts
          JOIN sellers ON sellers.id = community_posts.author_seller_id
          WHERE community_posts.hidden = false
          ORDER BY community_posts.created_at DESC
          LIMIT ${input.pageSize} OFFSET ${offset}
        `,
        sql`SELECT COUNT(*) AS count FROM community_posts WHERE hidden = false`,
      ]);

  return {
    posts: (rows as CommunityPostRow[]).map(rowToCommunityPostWithAuthor),
    total: Number((countRows as Array<{ count: string }>)[0]?.count ?? 0),
  };
}

export async function getCommunityPostById(id: string): Promise<CommunityPostWithAuthor | null> {
  await ensureInitialized();
  const sql = getSql();
  const rows = (await sql`
    SELECT community_posts.*, sellers.nickname AS author_nickname,
           sellers.profile_image_url AS author_profile_image_url
    FROM community_posts
    JOIN sellers ON sellers.id = community_posts.author_seller_id
    WHERE community_posts.id = ${id}
  `) as CommunityPostRow[];
  return rows[0] ? rowToCommunityPostWithAuthor(rows[0]) : null;
}

type CommunityCommentRow = {
  id: string;
  post_id: string;
  author_seller_id: string;
  content: string;
  hidden: boolean;
  created_at: string;
  author_nickname: string;
  author_profile_image_url: string | null;
};

function rowToCommunityCommentWithAuthor(row: CommunityCommentRow): CommunityCommentWithAuthor {
  return {
    id: row.id,
    postId: row.post_id,
    authorSellerId: row.author_seller_id,
    content: row.content,
    hidden: row.hidden,
    createdAt: row.created_at,
    authorNickname: row.author_nickname,
    authorProfileImageUrl: row.author_profile_image_url,
  };
}

export async function createCommunityComment(input: {
  postId: string;
  authorSellerId: string;
  content: string;
}): Promise<CommunityComment> {
  await ensureInitialized();
  const sql = getSql();

  const comment: CommunityComment = {
    id: randomUUID(),
    postId: input.postId,
    authorSellerId: input.authorSellerId,
    content: input.content,
    hidden: false,
    createdAt: new Date().toISOString(),
  };

  await sql`
    INSERT INTO community_comments (id, post_id, author_seller_id, content, hidden, created_at)
    VALUES (${comment.id}, ${comment.postId}, ${comment.authorSellerId}, ${comment.content}, ${comment.hidden}, ${comment.createdAt})
  `;

  return comment;
}

// hidden=false인 댓글만 노출한다 (신고 누적으로 자동 숨김된 댓글 제외).
export async function listCommunityCommentsForPost(
  postId: string
): Promise<CommunityCommentWithAuthor[]> {
  await ensureInitialized();
  const sql = getSql();
  const rows = (await sql`
    SELECT community_comments.*, sellers.nickname AS author_nickname,
           sellers.profile_image_url AS author_profile_image_url
    FROM community_comments
    JOIN sellers ON sellers.id = community_comments.author_seller_id
    WHERE community_comments.post_id = ${postId} AND community_comments.hidden = false
    ORDER BY community_comments.created_at ASC
  `) as CommunityCommentRow[];
  return rows.map(rowToCommunityCommentWithAuthor);
}

export async function hasReportedCommunityPost(
  postId: string,
  reporterSellerId: string
): Promise<boolean> {
  await ensureInitialized();
  const sql = getSql();
  const rows = (await sql`
    SELECT id FROM community_post_reports
    WHERE post_id = ${postId} AND reporter_seller_id = ${reporterSellerId}
  `) as Array<{ id: string }>;
  return rows.length > 0;
}

// 게시글/댓글 공통 자동 숨김 임계값.
const REPORT_AUTO_HIDE_THRESHOLD = 5;

export type ReportCommunityPostResult = "ok" | "already_reported";

// 중복 신고는 (post_id, reporter_seller_id) 유니크 인덱스로 막는다. 새 신고가
// 실제로 반영되면 그 글의 누적 신고 수를 세어 5건 이상이면 자동으로 숨긴다.
export async function reportCommunityPost(input: {
  postId: string;
  reporterSellerId: string;
}): Promise<ReportCommunityPostResult> {
  await ensureInitialized();
  const sql = getSql();

  const inserted = (await sql`
    INSERT INTO community_post_reports (id, post_id, reporter_seller_id, created_at)
    VALUES (${randomUUID()}, ${input.postId}, ${input.reporterSellerId}, ${new Date().toISOString()})
    ON CONFLICT (post_id, reporter_seller_id) DO NOTHING
    RETURNING id
  `) as Array<{ id: string }>;

  if (inserted.length === 0) {
    return "already_reported";
  }

  const countRows = (await sql`
    SELECT COUNT(*) AS count FROM community_post_reports WHERE post_id = ${input.postId}
  `) as Array<{ count: string }>;

  if (Number(countRows[0]?.count ?? 0) >= REPORT_AUTO_HIDE_THRESHOLD) {
    await sql`UPDATE community_posts SET hidden = true WHERE id = ${input.postId}`;
  }

  return "ok";
}

// 이 사용자가 이미 신고한 댓글 id만 골라 반환한다 (상세 페이지에서 댓글별
// 신고 버튼 비활성화 여부를 한 번의 쿼리로 판단하기 위함, N+1 방지).
export async function getReportedCommentIds(
  commentIds: string[],
  reporterSellerId: string
): Promise<Set<string>> {
  if (commentIds.length === 0) return new Set();
  await ensureInitialized();
  const sql = getSql();
  const rows = (await sql`
    SELECT comment_id FROM community_comment_reports
    WHERE reporter_seller_id = ${reporterSellerId} AND comment_id = ANY(${commentIds})
  `) as Array<{ comment_id: string }>;
  return new Set(rows.map((row) => row.comment_id));
}

export type ReportCommunityCommentResult = "ok" | "already_reported";

// 게시글과 동일하게, 새 신고가 실제로 반영되면 그 댓글의 누적 신고 수를 세어
// 5건 이상이면 자동으로 숨긴다.
export async function reportCommunityComment(input: {
  commentId: string;
  reporterSellerId: string;
}): Promise<ReportCommunityCommentResult> {
  await ensureInitialized();
  const sql = getSql();

  const inserted = (await sql`
    INSERT INTO community_comment_reports (id, comment_id, reporter_seller_id, created_at)
    VALUES (${randomUUID()}, ${input.commentId}, ${input.reporterSellerId}, ${new Date().toISOString()})
    ON CONFLICT (comment_id, reporter_seller_id) DO NOTHING
    RETURNING id
  `) as Array<{ id: string }>;

  if (inserted.length === 0) {
    return "already_reported";
  }

  const countRows = (await sql`
    SELECT COUNT(*) AS count FROM community_comment_reports WHERE comment_id = ${input.commentId}
  `) as Array<{ count: string }>;

  if (Number(countRows[0]?.count ?? 0) >= REPORT_AUTO_HIDE_THRESHOLD) {
    await sql`UPDATE community_comments SET hidden = true WHERE id = ${input.commentId}`;
  }

  return "ok";
}

// ============================================================
// 툴 수배 게시판 - 의뢰(Request) CRUD
// ============================================================

type ToolRequestRow = {
  id: string;
  requester_seller_id: string;
  title: string;
  description: string;
  budget_amount: number | null;
  budget_negotiable: boolean;
  desired_deadline: string | null;
  required_environment: string | null;
  reference_video_url: string | null;
  status: string;
  created_at: string;
};

function rowToToolRequest(row: ToolRequestRow): ToolRequest {
  return {
    id: row.id,
    requesterSellerId: row.requester_seller_id,
    title: row.title,
    description: row.description,
    budgetAmount: row.budget_amount,
    budgetNegotiable: row.budget_negotiable,
    desiredDeadline: row.desired_deadline,
    requiredEnvironment: row.required_environment,
    referenceVideoUrl: row.reference_video_url,
    status: row.status as ToolRequestStatus,
    createdAt: row.created_at,
  };
}

type ToolRequestWithAuthorRow = ToolRequestRow & {
  requester_nickname: string;
};

function rowToToolRequestWithAuthor(row: ToolRequestWithAuthorRow): ToolRequestWithAuthor {
  return {
    ...rowToToolRequest(row),
    requesterNickname: row.requester_nickname,
  };
}

export async function createToolRequest(input: {
  requesterSellerId: string;
  title: string;
  description: string;
  budgetAmount: number | null;
  budgetNegotiable: boolean;
  desiredDeadline: string | null;
  requiredEnvironment: string | null;
  referenceVideoUrl: string | null;
}): Promise<ToolRequest> {
  await ensureInitialized();
  const sql = getSql();

  const request: ToolRequest = {
    id: randomUUID(),
    requesterSellerId: input.requesterSellerId,
    title: input.title,
    description: input.description,
    budgetAmount: input.budgetAmount,
    budgetNegotiable: input.budgetNegotiable,
    desiredDeadline: input.desiredDeadline,
    requiredEnvironment: input.requiredEnvironment,
    referenceVideoUrl: input.referenceVideoUrl,
    status: "open",
    createdAt: new Date().toISOString(),
  };

  await sql`
    INSERT INTO tool_requests (
      id, requester_seller_id, title, description, budget_amount, budget_negotiable,
      desired_deadline, required_environment, reference_video_url, status, created_at
    )
    VALUES (
      ${request.id}, ${request.requesterSellerId}, ${request.title}, ${request.description},
      ${request.budgetAmount}, ${request.budgetNegotiable}, ${request.desiredDeadline},
      ${request.requiredEnvironment}, ${request.referenceVideoUrl}, ${request.status}, ${request.createdAt}
    )
  `;

  return request;
}

type ToolRequestImageRow = {
  id: string;
  request_id: string;
  image_url: string;
  sort_order: number;
  created_at: string;
};

function rowToToolRequestImage(row: ToolRequestImageRow): ToolRequestImage {
  return {
    id: row.id,
    requestId: row.request_id,
    imageUrl: row.image_url,
    sortOrder: row.sort_order,
    createdAt: row.created_at,
  };
}

// 여러 장을 순차 insert한다(트랜잭션 없음 - 기존 스타일). sort_order는 배열
// 인덱스로 채운다.
export async function addToolRequestImages(requestId: string, imageUrls: string[]): Promise<void> {
  await ensureInitialized();
  const sql = getSql();
  for (let i = 0; i < imageUrls.length; i++) {
    await sql`
      INSERT INTO tool_request_images (id, request_id, image_url, sort_order, created_at)
      VALUES (${randomUUID()}, ${requestId}, ${imageUrls[i]}, ${i}, ${new Date().toISOString()})
    `;
  }
}

// 카테고리 필터는 없다 - 이 게시판은 단일 유형이다.
export async function listToolRequests(input: {
  page: number;
  pageSize: number;
}): Promise<{ requests: ToolRequestWithAuthor[]; total: number }> {
  await ensureInitialized();
  const sql = getSql();
  const offset = (input.page - 1) * input.pageSize;

  const [rows, countRows] = await Promise.all([
    sql`
      SELECT tool_requests.*, sellers.nickname AS requester_nickname
      FROM tool_requests
      JOIN sellers ON sellers.id = tool_requests.requester_seller_id
      ORDER BY tool_requests.created_at DESC
      LIMIT ${input.pageSize} OFFSET ${offset}
    `,
    sql`SELECT COUNT(*) AS count FROM tool_requests`,
  ]);

  return {
    requests: (rows as ToolRequestWithAuthorRow[]).map(rowToToolRequestWithAuthor),
    total: Number((countRows as Array<{ count: string }>)[0]?.count ?? 0),
  };
}

export async function getToolRequestById(id: string): Promise<ToolRequestWithAuthor | null> {
  await ensureInitialized();
  const sql = getSql();
  const rows = (await sql`
    SELECT tool_requests.*, sellers.nickname AS requester_nickname
    FROM tool_requests
    JOIN sellers ON sellers.id = tool_requests.requester_seller_id
    WHERE tool_requests.id = ${id}
  `) as ToolRequestWithAuthorRow[];
  return rows[0] ? rowToToolRequestWithAuthor(rows[0]) : null;
}

export async function listToolRequestImages(requestId: string): Promise<ToolRequestImage[]> {
  await ensureInitialized();
  const sql = getSql();
  const rows = (await sql`
    SELECT * FROM tool_request_images
    WHERE request_id = ${requestId}
    ORDER BY sort_order ASC
  `) as ToolRequestImageRow[];
  return rows.map(rowToToolRequestImage);
}

export async function getToolRequestImageById(id: string): Promise<ToolRequestImage | null> {
  await ensureInitialized();
  const sql = getSql();
  const rows = (await sql`
    SELECT * FROM tool_request_images WHERE id = ${id}
  `) as ToolRequestImageRow[];
  return rows[0] ? rowToToolRequestImage(rows[0]) : null;
}

// 의뢰가 'open' 상태일 때만(app/api/requests/[requestId]/route.ts에서 확인)
// 호출되는 수정. status/requester_seller_id/created_at은 여기서 바꾸지 않는다.
export async function updateToolRequest(input: {
  id: string;
  title: string;
  description: string;
  budgetAmount: number | null;
  budgetNegotiable: boolean;
  desiredDeadline: string | null;
  requiredEnvironment: string | null;
  referenceVideoUrl: string | null;
}): Promise<void> {
  await ensureInitialized();
  const sql = getSql();
  await sql`
    UPDATE tool_requests
    SET title = ${input.title},
        description = ${input.description},
        budget_amount = ${input.budgetAmount},
        budget_negotiable = ${input.budgetNegotiable},
        desired_deadline = ${input.desiredDeadline},
        required_environment = ${input.requiredEnvironment},
        reference_video_url = ${input.referenceVideoUrl}
    WHERE id = ${input.id}
  `;
}

// 기존 사진 목록을 전부 지우고 imageUrls로 다시 채운다(유지된 기존 URL +
// 새로 업로드된 URL을 순서대로 합친 배열을 그대로 받는다).
export async function replaceToolRequestImages(requestId: string, imageUrls: string[]): Promise<void> {
  await ensureInitialized();
  const sql = getSql();
  await sql`DELETE FROM tool_request_images WHERE request_id = ${requestId}`;
  for (let i = 0; i < imageUrls.length; i++) {
    await sql`
      INSERT INTO tool_request_images (id, request_id, image_url, sort_order, created_at)
      VALUES (${randomUUID()}, ${requestId}, ${imageUrls[i]}, ${i}, ${new Date().toISOString()})
    `;
  }
}

// 'open' 상태일 때만 호출된다 - 이 상태에서는 선택된 제안이 있을 수 없으므로
// (selectToolProposal이 상태를 'in_progress'로 바꾸는 것과 원자적으로 묶여
// 있다) 제안 스레드 메시지도 존재할 수 없지만, FK 순서상 안전하게 자식부터
// 지운다.
export async function deleteToolRequest(requestId: string): Promise<void> {
  await ensureInitialized();
  const sql = getSql();
  await sql`
    DELETE FROM tool_proposal_messages
    WHERE proposal_id IN (SELECT id FROM tool_proposals WHERE request_id = ${requestId})
  `;
  await sql`DELETE FROM tool_proposals WHERE request_id = ${requestId}`;
  await sql`DELETE FROM tool_request_images WHERE request_id = ${requestId}`;
  await sql`DELETE FROM tool_requests WHERE id = ${requestId}`;
}

// ============================================================
// 툴 수배 게시판 - 제안(Proposal) CRUD
// ============================================================

type ToolProposalRow = {
  id: string;
  request_id: string;
  seller_id: string;
  price: number;
  duration: string;
  description: string;
  status: string;
  delivered_listing_id: string | null;
  delivery_confirmed_at: string | null;
  delivery_guide: string | null;
  created_at: string;
};

function rowToToolProposal(row: ToolProposalRow): ToolProposal {
  return {
    id: row.id,
    requestId: row.request_id,
    sellerId: row.seller_id,
    price: row.price,
    duration: row.duration,
    description: row.description,
    status: row.status as ToolProposalStatus,
    deliveredListingId: row.delivered_listing_id,
    deliveryConfirmedAt: row.delivery_confirmed_at,
    deliveryGuide: row.delivery_guide,
    createdAt: row.created_at,
  };
}

type ToolProposalWithAuthorRow = ToolProposalRow & {
  seller_nickname: string;
  seller_profile_image_url: string | null;
};

function rowToToolProposalWithAuthor(row: ToolProposalWithAuthorRow): ToolProposalWithAuthor {
  return {
    ...rowToToolProposal(row),
    sellerNickname: row.seller_nickname,
    sellerProfileImageUrl: row.seller_profile_image_url,
  };
}

// 호출부(API 라우트)에서 미리 request.status === 'open' 확인 후 호출한다.
export async function createToolProposal(input: {
  requestId: string;
  sellerId: string;
  price: number;
  duration: string;
  description: string;
}): Promise<ToolProposal> {
  await ensureInitialized();
  const sql = getSql();

  const proposal: ToolProposal = {
    id: randomUUID(),
    requestId: input.requestId,
    sellerId: input.sellerId,
    price: input.price,
    duration: input.duration,
    description: input.description,
    status: "pending",
    deliveredListingId: null,
    deliveryConfirmedAt: null,
    deliveryGuide: null,
    createdAt: new Date().toISOString(),
  };

  await sql`
    INSERT INTO tool_proposals (
      id, request_id, seller_id, price, duration, description, status,
      delivered_listing_id, delivery_confirmed_at, created_at
    )
    VALUES (
      ${proposal.id}, ${proposal.requestId}, ${proposal.sellerId}, ${proposal.price},
      ${proposal.duration}, ${proposal.description}, ${proposal.status},
      ${proposal.deliveredListingId}, ${proposal.deliveryConfirmedAt}, ${proposal.createdAt}
    )
  `;

  return proposal;
}

export async function listToolProposalsForRequest(requestId: string): Promise<ToolProposalWithAuthor[]> {
  await ensureInitialized();
  const sql = getSql();
  const rows = (await sql`
    SELECT tool_proposals.*, sellers.nickname AS seller_nickname,
           sellers.profile_image_url AS seller_profile_image_url
    FROM tool_proposals
    JOIN sellers ON sellers.id = tool_proposals.seller_id
    WHERE tool_proposals.request_id = ${requestId}
    ORDER BY tool_proposals.created_at ASC
  `) as ToolProposalWithAuthorRow[];
  return rows.map(rowToToolProposalWithAuthor);
}

export async function getToolProposalById(id: string): Promise<ToolProposal | null> {
  await ensureInitialized();
  const sql = getSql();
  const rows = (await sql`
    SELECT * FROM tool_proposals WHERE id = ${id}
  `) as ToolProposalRow[];
  return rows[0] ? rowToToolProposal(rows[0]) : null;
}

// reportCommunityPost처럼 원자적으로 처리한다: 먼저 tool_requests를
// status='open' -> 'in_progress'로 잠그고(0행이면 이미 처리됐거나 권한 없음 -> false),
// 성공하면 해당 제안만 status='selected'로 바꾼다. 나머지 제안들의 status는
// 건드리지 않는다 - UI에서 request.status !== 'open'이면 "선택 마감"으로 표시한다.
export async function selectToolProposal(
  requestId: string,
  proposalId: string,
  requesterSellerId: string
): Promise<boolean> {
  await ensureInitialized();
  const sql = getSql();

  const lockedRows = (await sql`
    UPDATE tool_requests
    SET status = 'in_progress'
    WHERE id = ${requestId} AND requester_seller_id = ${requesterSellerId} AND status = 'open'
    RETURNING id
  `) as Array<{ id: string }>;

  if (lockedRows.length === 0) {
    return false;
  }

  await sql`
    UPDATE tool_proposals SET status = 'selected'
    WHERE id = ${proposalId} AND request_id = ${requestId}
  `;

  return true;
}

// ============================================================
// 툴 수배 게시판 - 납품/스캔 연동
// ============================================================

export async function markProposalDelivered(proposalId: string, listingId: string): Promise<void> {
  await ensureInitialized();
  const sql = getSql();
  await sql`
    UPDATE tool_proposals SET delivered_listing_id = ${listingId} WHERE id = ${proposalId}
  `;
}

// 스캔 게이트 통과 후, 의뢰자에게 알림을 보내는 시점에 호출한다.
export async function confirmProposalDelivery(proposalId: string): Promise<void> {
  await ensureInitialized();
  const sql = getSql();
  await sql`
    UPDATE tool_proposals SET delivery_confirmed_at = ${new Date().toISOString()} WHERE id = ${proposalId}
  `;
}

// 같은 의뢰에 완성본을 다시 제출하는 시점에 호출한다. delivery_confirmed_at은 한 번
// 찍히면 남아있기 때문에, 새 제출물이 아직 스캔 게이트를 통과하지 않았는데도 의뢰자
// 화면에 "검사 통과한 완성본"으로 보이는 일을 막으려면 제출 직전에 되돌려야 한다.
export async function clearProposalDeliveryConfirmation(proposalId: string): Promise<void> {
  await ensureInitialized();
  const sql = getSql();
  await sql`
    UPDATE tool_proposals SET delivery_confirmed_at = NULL WHERE id = ${proposalId}
  `;
}

// 완성본 제출/재스캔 시점마다 호출한다 - 제작자가 남긴 실행 가이드(설치·실행
// 방법)를 저장/갱신한다. 서버 액션에서 최소 길이 검증을 마친 뒤에만 호출된다.
export async function updateProposalDeliveryGuide(
  proposalId: string,
  deliveryGuide: string
): Promise<void> {
  await ensureInitialized();
  const sql = getSql();
  await sql`
    UPDATE tool_proposals SET delivery_guide = ${deliveryGuide} WHERE id = ${proposalId}
  `;
}

// getPublicScanSummary와 동일 원칙(판매자 전용 세부정보는 groupFindingsForBuyer가
// 제외)이지만, 접근 허용 기준이 listings.published가 아니라 역할이다: viewerSellerId가
// 이 요청의 requester_seller_id이거나, status='selected' AND delivery_confirmed_at IS
// NOT NULL인 그 제안의 seller_id인 경우에만 값을 반환하고 그 외에는 전부 null이다.
// (다른 제안자, 다른 판매자, 비로그인 모두 null - 페이지 쪽 조건부 호출과 별개로
// 이 함수 내부에서도 이중으로 막는다.)
export async function getDeliveryScanSummaryForViewer(
  requestId: string,
  viewerSellerId: string
): Promise<{ proposal: ToolProposal; listing: Listing; findings: PublicFindingGroup[] } | null> {
  await ensureInitialized();
  const sql = getSql();

  const requestRows = (await sql`
    SELECT requester_seller_id FROM tool_requests WHERE id = ${requestId}
  `) as Array<{ requester_seller_id: string }>;
  const requesterSellerId = requestRows[0]?.requester_seller_id;
  if (!requesterSellerId) return null;

  const proposalRows = (await sql`
    SELECT * FROM tool_proposals
    WHERE request_id = ${requestId} AND status = 'selected' AND delivery_confirmed_at IS NOT NULL
    LIMIT 1
  `) as ToolProposalRow[];
  const proposalRow = proposalRows[0];
  if (!proposalRow) return null;

  const proposal = rowToToolProposal(proposalRow);

  // 이중 접근 체크: 의뢰자 본인이거나 선택된(납품 확정된) 제안의 판매자 본인만 통과한다.
  if (viewerSellerId !== requesterSellerId && viewerSellerId !== proposal.sellerId) {
    return null;
  }

  if (!proposal.deliveredListingId) return null;

  const listingRows = (await sql`
    SELECT * FROM listings WHERE id = ${proposal.deliveredListingId}
  `) as ListingRow[];
  const listingRow = listingRows[0];
  if (!listingRow) return null;
  const listing = rowToListing(listingRow);

  const scanRows = (await sql`
    SELECT findings FROM scan_reports
    WHERE listing_id = ${listing.id}
    ORDER BY created_at DESC
    LIMIT 1
  `) as Array<{ findings: Finding[] }>;
  const scanReport = scanRows[0];
  const findings = scanReport ? groupFindingsForBuyer(scanReport.findings) : [];

  return { proposal, listing, findings };
}

// 더미 결제 확인 버튼용 - 원자적 가드(UPDATE ... WHERE ... AND status=... RETURNING).
export async function completeToolRequest(
  requestId: string,
  requesterSellerId: string
): Promise<boolean> {
  await ensureInitialized();
  const sql = getSql();
  const rows = (await sql`
    UPDATE tool_requests
    SET status = 'completed'
    WHERE id = ${requestId} AND requester_seller_id = ${requesterSellerId} AND status = 'in_progress'
    RETURNING id
  `) as Array<{ id: string }>;
  return rows.length > 0;
}

export async function canDeliverProposal(
  requestId: string,
  proposalId: string,
  sellerId: string
): Promise<boolean> {
  await ensureInitialized();
  const sql = getSql();
  const rows = (await sql`
    SELECT id FROM tool_proposals
    WHERE id = ${proposalId} AND request_id = ${requestId} AND seller_id = ${sellerId} AND status = 'selected'
  `) as Array<{ id: string }>;
  return rows.length > 0;
}

// Task 8(재등록 프리필 검증)에서 사용.
export async function hasConfirmedDeliveryForRequest(
  sellerId: string,
  requestId: string
): Promise<boolean> {
  await ensureInitialized();
  const sql = getSql();
  const rows = (await sql`
    SELECT id FROM tool_proposals
    WHERE request_id = ${requestId} AND seller_id = ${sellerId} AND delivered_listing_id IS NOT NULL
  `) as Array<{ id: string }>;
  return rows.length > 0;
}

// ============================================================
// 툴 수배 게시판 - 비공개 스레드(제안별 1:1 메시지)
// ============================================================

export async function canAccessProposalThread(proposalId: string, sellerId: string): Promise<boolean> {
  await ensureInitialized();
  const sql = getSql();
  const rows = (await sql`
    SELECT tool_proposals.id
    FROM tool_proposals
    JOIN tool_requests ON tool_requests.id = tool_proposals.request_id
    WHERE tool_proposals.id = ${proposalId}
      AND (tool_proposals.seller_id = ${sellerId} OR tool_requests.requester_seller_id = ${sellerId})
  `) as Array<{ id: string }>;
  return rows.length > 0;
}

type ToolProposalMessageRow = {
  id: string;
  proposal_id: string;
  sender_seller_id: string;
  content: string;
  created_at: string;
};

function rowToToolProposalMessage(row: ToolProposalMessageRow): ToolProposalMessage {
  return {
    id: row.id,
    proposalId: row.proposal_id,
    senderSellerId: row.sender_seller_id,
    content: row.content,
    createdAt: row.created_at,
  };
}

type ToolProposalMessageWithAuthorRow = ToolProposalMessageRow & {
  sender_nickname: string;
};

function rowToToolProposalMessageWithAuthor(
  row: ToolProposalMessageWithAuthorRow
): ToolProposalMessageWithAuthor {
  return {
    ...rowToToolProposalMessage(row),
    senderNickname: row.sender_nickname,
  };
}

// 호출부에서 반드시 canAccessProposalThread를 먼저 확인한다(이 함수 자체는
// 접근 체크를 하지 않는다 - listCommunityCommentsForPost와 동일한 책임 분리 스타일).
export async function listToolProposalMessages(
  proposalId: string
): Promise<ToolProposalMessageWithAuthor[]> {
  await ensureInitialized();
  const sql = getSql();
  const rows = (await sql`
    SELECT tool_proposal_messages.*, sellers.nickname AS sender_nickname
    FROM tool_proposal_messages
    JOIN sellers ON sellers.id = tool_proposal_messages.sender_seller_id
    WHERE tool_proposal_messages.proposal_id = ${proposalId}
    ORDER BY tool_proposal_messages.created_at ASC
  `) as ToolProposalMessageWithAuthorRow[];
  return rows.map(rowToToolProposalMessageWithAuthor);
}

export async function createToolProposalMessage(input: {
  proposalId: string;
  senderSellerId: string;
  content: string;
}): Promise<ToolProposalMessage> {
  await ensureInitialized();
  const sql = getSql();

  const message: ToolProposalMessage = {
    id: randomUUID(),
    proposalId: input.proposalId,
    senderSellerId: input.senderSellerId,
    content: input.content,
    createdAt: new Date().toISOString(),
  };

  await sql`
    INSERT INTO tool_proposal_messages (id, proposal_id, sender_seller_id, content, created_at)
    VALUES (${message.id}, ${message.proposalId}, ${message.senderSellerId}, ${message.content}, ${message.createdAt})
  `;

  return message;
}
