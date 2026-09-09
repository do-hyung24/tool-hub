import "server-only";
import { neon, type NeonQueryFunction } from "@neondatabase/serverless";
import type { Finding, Listing, Seller } from "./types";

// Vercel의 Neon 연동은 DATABASE_URL과 POSTGRES_URL을 함께 넣어주므로 둘 다 확인한다.
let sqlClient: NeonQueryFunction<false, false> | null = null;

export function getSql(): NeonQueryFunction<false, false> {
  if (!sqlClient) {
    const connectionString = process.env.DATABASE_URL ?? process.env.POSTGRES_URL;
    if (!connectionString) {
      throw new Error(
        "DATABASE_URL(또는 POSTGRES_URL) 환경변수가 설정되지 않았습니다. " +
          "Vercel Postgres(Neon) 연동에서 값을 가져와 .env.local에 추가해주세요."
      );
    }
    sqlClient = neon(connectionString);
  }
  return sqlClient;
}

// 시드 판매자는 로그인 계정이 없는 레거시 데이터입니다 (email/password 미설정).
// 실제 회원가입으로 만들어진 계정만 로그인할 수 있습니다.
const SEED_SELLERS: Seller[] = [
  {
    id: "s1",
    nickname: "봇공작소",
    contact: "open.kakao.com/o/gBotFactory",
    email: null,
    emailVerified: false,
    deletionRequestedAt: null,
    profileImageUrl: null,
  },
  {
    id: "s2",
    nickname: "크롤킹",
    contact: "crawlking@example.com",
    email: null,
    emailVerified: false,
    deletionRequestedAt: null,
    profileImageUrl: null,
  },
  {
    id: "s3",
    nickname: "야매개발자",
    contact: "@yamae_dev (텔레그램)",
    email: null,
    emailVerified: false,
    deletionRequestedAt: null,
    profileImageUrl: null,
  },
];

const SEED_LISTINGS: Listing[] = [
  {
    id: "l1",
    title: "쿠팡 최저가 알림 봇",
    description:
      "관심 상품의 가격이 설정한 기준 이하로 떨어지면 텔레그램으로 알림을 보내주는 스크립트입니다. 파이썬 기반, 설치 가이드 포함.",
    price: 30000,
    category: "알림/모니터링 봇",
    codeUrl: "https://github.com/example/coupang-price-bot",
    sourceType: "github",
    published: true,
    scanStatus: "completed",
    disclosureNote: null,
    hasUnresolvedFindings: false,
    createdAt: "2026-08-20T09:00:00.000Z",
    sellerId: "s1",
  },
  {
    id: "l2",
    title: "네이버 카페 게시글 크롤러",
    description:
      "특정 카페의 새 게시글을 주기적으로 수집해 구글 시트에 정리해주는 자동화 스크립트입니다.",
    price: 50000,
    category: "크롤러/스크래퍼",
    codeUrl: "https://github.com/example/naver-cafe-crawler",
    sourceType: "github",
    published: true,
    scanStatus: "completed",
    disclosureNote:
      "설정 파일의 API 키는 예시용 더미 값입니다. 실제 사용 전 본인 키로 교체해주세요.",
    hasUnresolvedFindings: true,
    createdAt: "2026-08-18T09:00:00.000Z",
    sellerId: "s2",
  },
  {
    id: "l3",
    title: "엑셀 반복 업무 자동화 매크로",
    description:
      "매일 반복되는 엑셀 취합/보고서 작성 업무를 자동화하는 매크로입니다. 비개발자도 설정 파일만 수정하면 바로 사용 가능합니다.",
    price: 20000,
    category: "업무 자동화(RPA)",
    codeUrl: "https://github.com/example/excel-report-macro",
    sourceType: "github",
    published: true,
    scanStatus: "completed",
    disclosureNote: null,
    hasUnresolvedFindings: false,
    createdAt: "2026-08-22T09:00:00.000Z",
    sellerId: "s3",
  },
];

// l2는 발견된 문제(시크릿 하드코딩)를 안고도 판매자가 그대로 게시하기로 선택한
// 예시 데이터입니다. 리포트 화면 데모용으로 함께 시드합니다.
const SEED_SCAN_REPORTS: Array<{
  id: string;
  listingId: string;
  authorId: string;
  findings: Finding[];
  ruleEngineVersion: string;
  createdAt: string;
}> = [
  {
    id: "sr-l2-1",
    listingId: "l2",
    authorId: "s2",
    ruleEngineVersion: "rule-engine-2026-08-27-v1",
    createdAt: "2026-08-18T09:00:00.000Z",
    findings: [
      {
        id: "f-l2-1",
        severity: "critical",
        confidence: "high",
        type: "hardcoded-secret",
        cwe: "CWE-798",
        filePath: "config.py",
        location: "12번째 줄",
        maskedEvidence: "AIz***...f2a",
        description: "Google API 키로 보이는 문자열이 하드코딩되어 있습니다.",
      },
    ],
  },
];

let initPromise: Promise<void> | null = null;

// 앱이 처음 DB에 접근할 때 딱 한 번만 스키마 생성/마이그레이션 + 시드 삽입을 수행한다.
// 서버 인스턴스가 살아있는 동안은 이 Promise가 캐시되어 재실행되지 않는다.
export function ensureInitialized(): Promise<void> {
  if (!initPromise) {
    initPromise = initialize().catch((error) => {
      initPromise = null;
      throw error;
    });
  }
  return initPromise;
}

async function initialize(): Promise<void> {
  const sql = getSql();

  await sql`
    CREATE TABLE IF NOT EXISTS sellers (
      id TEXT PRIMARY KEY,
      nickname TEXT NOT NULL,
      contact TEXT NOT NULL,
      email TEXT,
      password_hash TEXT,
      email_verified BOOLEAN NOT NULL DEFAULT FALSE
    )
  `;

  // 기존(구버전) sellers 테이블에 로그인 관련 컬럼을 추가한다. 이미 새 스키마로
  // 생성된 DB에서는 no-op이다.
  await sql`ALTER TABLE sellers ADD COLUMN IF NOT EXISTS email TEXT`;
  await sql`ALTER TABLE sellers ADD COLUMN IF NOT EXISTS password_hash TEXT`;
  await sql`ALTER TABLE sellers ADD COLUMN IF NOT EXISTS email_verified BOOLEAN NOT NULL DEFAULT FALSE`;
  // 탈퇴 요청 시각(ISO 문자열). NULL이면 정상 계정, 값이 있으면 14일 유예 기간 중이며
  // 로그인이 차단되고 매물이 공개 목록에서 즉시 숨겨진다 (lib/auth.ts, lib/data.ts 참고).
  await sql`ALTER TABLE sellers ADD COLUMN IF NOT EXISTS deletion_requested_at TEXT`;
  // 프로필 사진의 Vercel Blob URL. NULL이면 기본 아바타를 표시한다.
  await sql`ALTER TABLE sellers ADD COLUMN IF NOT EXISTS profile_image_url TEXT`;

  // 유니크 인덱스를 걸기 전, 이미 중복된 값이 있으면 인덱스 생성 자체가 실패해
  // 이후 모든 요청에서 ensureInitialized()가 계속 예외를 던지는 전면 장애로
  // 이어진다. 나중 것부터 접미사를 붙여 결정적으로 정리한 뒤 인덱스를 만든다.
  // (email은 NULL을 허용하고, NULL끼리는 유니크 인덱스에서 충돌하지 않으므로 제외.)
  await sql`
    UPDATE sellers SET email = sellers.email || '-' || ranked.rn
    FROM (
      SELECT id, row_number() OVER (PARTITION BY email ORDER BY id) AS rn
      FROM sellers WHERE email IS NOT NULL
    ) AS ranked
    WHERE sellers.id = ranked.id AND ranked.rn > 1
  `;
  await sql`
    UPDATE sellers SET nickname = sellers.nickname || '-' || ranked.rn
    FROM (
      SELECT id, row_number() OVER (PARTITION BY nickname ORDER BY id) AS rn
      FROM sellers
    ) AS ranked
    WHERE sellers.id = ranked.id AND ranked.rn > 1
  `;
  await sql`CREATE UNIQUE INDEX IF NOT EXISTS idx_sellers_email ON sellers (email)`;
  await sql`CREATE UNIQUE INDEX IF NOT EXISTS idx_sellers_nickname ON sellers (nickname)`;

  await sql`
    CREATE TABLE IF NOT EXISTS email_verification_tokens (
      token TEXT PRIMARY KEY,
      seller_id TEXT NOT NULL REFERENCES sellers(id),
      code TEXT NOT NULL DEFAULT '',
      attempts INTEGER NOT NULL DEFAULT 0,
      expires_at TEXT NOT NULL,
      created_at TEXT NOT NULL
    )
  `;
  // 기존(구버전) 테이블에 코드 입력 인증용 컬럼을 추가한다.
  await sql`ALTER TABLE email_verification_tokens ADD COLUMN IF NOT EXISTS code TEXT NOT NULL DEFAULT ''`;
  await sql`ALTER TABLE email_verification_tokens ADD COLUMN IF NOT EXISTS attempts INTEGER NOT NULL DEFAULT 0`;
  await sql`CREATE INDEX IF NOT EXISTS idx_verification_tokens_seller ON email_verification_tokens(seller_id)`;

  // 이메일 인증 토큰과는 별개 테이블이다 - email_verification_tokens는 seller당
  // 활성 토큰 1개만 허용(재발급 시 이전 것을 삭제)하고 원문 토큰을 그대로 저장하는데,
  // 비밀번호 재설정은 해시만 저장해야 하고 인증 토큰 발급/삭제와 서로 간섭하면 안 된다.
  await sql`
    CREATE TABLE IF NOT EXISTS password_reset_tokens (
      token_hash TEXT PRIMARY KEY,
      seller_id TEXT NOT NULL REFERENCES sellers(id),
      expires_at TEXT NOT NULL,
      used_at TEXT,
      created_at TEXT NOT NULL
    )
  `;
  await sql`CREATE INDEX IF NOT EXISTS idx_password_reset_tokens_seller ON password_reset_tokens(seller_id)`;

  await sql`
    CREATE TABLE IF NOT EXISTS listings (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      description TEXT NOT NULL,
      price INTEGER NOT NULL,
      category TEXT NOT NULL,
      code_url TEXT,
      source_type TEXT NOT NULL DEFAULT 'github',
      published BOOLEAN NOT NULL DEFAULT FALSE,
      scan_status TEXT NOT NULL DEFAULT 'pending',
      disclosure_note TEXT,
      has_unresolved_findings BOOLEAN NOT NULL DEFAULT FALSE,
      created_at TEXT NOT NULL,
      seller_id TEXT NOT NULL REFERENCES sellers(id)
    )
  `;

  // 기존(구버전) listings 테이블을 새 스펙에 맞게 이관한다. 이미 새 스키마로
  // 생성된 DB에서는 전부 no-op이다.
  await sql`ALTER TABLE listings ADD COLUMN IF NOT EXISTS source_type TEXT NOT NULL DEFAULT 'github'`;
  await sql`ALTER TABLE listings ADD COLUMN IF NOT EXISTS published BOOLEAN NOT NULL DEFAULT FALSE`;
  await sql`ALTER TABLE listings ADD COLUMN IF NOT EXISTS scan_status TEXT NOT NULL DEFAULT 'pending'`;
  await sql`ALTER TABLE listings ADD COLUMN IF NOT EXISTS disclosure_note TEXT`;
  await sql`ALTER TABLE listings ADD COLUMN IF NOT EXISTS has_unresolved_findings BOOLEAN NOT NULL DEFAULT FALSE`;
  await sql`ALTER TABLE listings ALTER COLUMN code_url DROP NOT NULL`;
  await sql`ALTER TABLE listings DROP COLUMN IF EXISTS scan_result`;
  await sql`ALTER TABLE listings DROP COLUMN IF EXISTS is_verified`;

  await sql`
    CREATE TABLE IF NOT EXISTS scan_reports (
      id TEXT PRIMARY KEY,
      listing_id TEXT NOT NULL REFERENCES listings(id),
      author_id TEXT NOT NULL REFERENCES sellers(id),
      findings JSONB NOT NULL,
      rule_engine_version TEXT NOT NULL,
      created_at TEXT NOT NULL
    )
  `;
  await sql`CREATE INDEX IF NOT EXISTS idx_scan_reports_listing ON scan_reports(listing_id)`;

  for (const seller of SEED_SELLERS) {
    await sql`
      INSERT INTO sellers (id, nickname, contact)
      VALUES (${seller.id}, ${seller.nickname}, ${seller.contact})
      ON CONFLICT (id) DO NOTHING
    `;
  }

  for (const listing of SEED_LISTINGS) {
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
      ON CONFLICT (id) DO UPDATE SET
        source_type = EXCLUDED.source_type,
        published = EXCLUDED.published,
        scan_status = EXCLUDED.scan_status,
        disclosure_note = EXCLUDED.disclosure_note,
        has_unresolved_findings = EXCLUDED.has_unresolved_findings
    `;
  }

  for (const report of SEED_SCAN_REPORTS) {
    await sql`
      INSERT INTO scan_reports (id, listing_id, author_id, findings, rule_engine_version, created_at)
      VALUES (
        ${report.id}, ${report.listingId}, ${report.authorId},
        ${JSON.stringify(report.findings)}, ${report.ruleEngineVersion}, ${report.createdAt}
      )
      ON CONFLICT (id) DO NOTHING
    `;
  }
}
