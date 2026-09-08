import "server-only";
import { createHash, randomBytes, randomUUID } from "node:crypto";
import { ensureInitialized, getSql } from "./db";
import { groupFindingsForBuyer } from "./findingCategories";
import type { PublicFindingGroup } from "./findingCategories";
import { BLOCKING_SEVERITIES } from "./types";
import type {
  Category,
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
  };
}

// 공개 매물 목록 - 게시(published)된 것만 노출한다.
export async function getListings(): Promise<Listing[]> {
  await ensureInitialized();
  const sql = getSql();
  const rows = (await sql`
    SELECT * FROM listings WHERE published = true ORDER BY created_at DESC
  `) as ListingRow[];
  return rows.map(rowToListing);
}

// 공개 상세 페이지용 - 게시되지 않은(작성자 검토 중) 매물은 존재 자체를 숨긴다.
export async function getListingById(id: string): Promise<Listing | null> {
  await ensureInitialized();
  const sql = getSql();
  const rows = (await sql`
    SELECT * FROM listings WHERE id = ${id} AND published = true
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
    SELECT id, nickname, contact, email, email_verified FROM sellers WHERE id = ${id}
  `) as SellerRow[];
  return rows[0] ? rowToSeller(rows[0]) : null;
}

export async function getSellerByEmail(email: string): Promise<Seller | null> {
  await ensureInitialized();
  const sql = getSql();
  const rows = (await sql`
    SELECT id, nickname, contact, email, email_verified
    FROM sellers WHERE email = ${email.trim().toLowerCase()}
  `) as SellerRow[];
  return rows[0] ? rowToSeller(rows[0]) : null;
}

export async function getSellerByNickname(nickname: string): Promise<Seller | null> {
  await ensureInitialized();
  const sql = getSql();
  const rows = (await sql`
    SELECT id, nickname, contact, email, email_verified
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

const VERIFICATION_TTL_MS = 15 * 60 * 1000; // 15분 - 직접 입력하는 코드라 짧게 잡는다.
const MAX_CODE_ATTEMPTS = 5;

function generateSixDigitCode(): string {
  return String(Math.floor(Math.random() * 1_000_000)).padStart(6, "0");
}

// 인증 메일을 (재)발송할 때 이전에 발급된 토큰/코드는 모두 무효화한다.
// 링크(token)와 6자리 코드(code)를 함께 발급해서, 이메일에서 어느 쪽을
// 쓰든 인증할 수 있게 한다.
export async function createEmailVerificationToken(
  sellerId: string
): Promise<{ token: string; code: string }> {
  await ensureInitialized();
  const sql = getSql();

  await sql`DELETE FROM email_verification_tokens WHERE seller_id = ${sellerId}`;

  const token = randomUUID();
  const code = generateSixDigitCode();
  const expiresAt = new Date(Date.now() + VERIFICATION_TTL_MS).toISOString();
  await sql`
    INSERT INTO email_verification_tokens (token, seller_id, code, attempts, expires_at, created_at)
    VALUES (${token}, ${sellerId}, ${code}, 0, ${expiresAt}, ${new Date().toISOString()})
  `;

  return { token, code };
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
