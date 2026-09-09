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
  SourceType,
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
    SELECT id, nickname, contact, email, email_verified, deletion_requested_at, profile_image_url
    FROM sellers WHERE id = ${id}
  `) as SellerRow[];
  return rows[0] ? rowToSeller(rows[0]) : null;
}

export async function getSellerByEmail(email: string): Promise<Seller | null> {
  await ensureInitialized();
  const sql = getSql();
  const rows = (await sql`
    SELECT id, nickname, contact, email, email_verified, profile_image_url
    FROM sellers WHERE email = ${email.trim().toLowerCase()}
  `) as SellerRow[];
  return rows[0] ? rowToSeller(rows[0]) : null;
}

export async function getSellerByNickname(nickname: string): Promise<Seller | null> {
  await ensureInitialized();
  const sql = getSql();
  const rows = (await sql`
    SELECT id, nickname, contact, email, email_verified, profile_image_url
    FROM sellers WHERE nickname = ${nickname.trim()}
  `) as SellerRow[];
  return rows[0] ? rowToSeller(rows[0]) : null;
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
  };

  await sql`
    INSERT INTO sellers (id, nickname, contact, email, password_hash, email_verified)
    VALUES (
      ${seller.id}, ${seller.nickname}, ${seller.contact},
      ${seller.email}, ${input.passwordHash}, false
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
  };

  await sql`
    INSERT INTO listings (
      id, title, description, price, category, code_url, source_type,
      published, scan_status, disclosure_note, has_unresolved_findings,
      created_at, seller_id
    )
    VALUES (
      ${listing.id}, ${listing.title}, ${listing.description}, ${listing.price},
      ${listing.category}, ${listing.codeUrl}, ${listing.sourceType},
      ${listing.published}, ${listing.scanStatus}, ${listing.disclosureNote},
      ${listing.hasUnresolvedFindings}, ${listing.createdAt}, ${listing.sellerId}
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
