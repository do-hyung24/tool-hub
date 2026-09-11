import "server-only";
import { neon, type NeonQueryFunction } from "@neondatabase/serverless";
import type { Finding, Listing, Seller } from "./types";
import { SUPPORT_EMAIL } from "./constants";

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
    createdAt: "2026-08-01T00:00:00.000Z",
  },
  {
    id: "s2",
    nickname: "크롤킹",
    contact: "crawlking@example.com",
    email: null,
    emailVerified: false,
    deletionRequestedAt: null,
    profileImageUrl: null,
    createdAt: "2026-08-01T00:00:00.000Z",
  },
  {
    id: "s3",
    nickname: "야매개발자",
    contact: "@yamae_dev (텔레그램)",
    email: null,
    emailVerified: false,
    deletionRequestedAt: null,
    profileImageUrl: null,
    createdAt: "2026-08-01T00:00:00.000Z",
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
    sourceRequestId: null,
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
    sourceRequestId: null,
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
    sourceRequestId: null,
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

// 커뮤니티 오픈 시 운영자 명의로 등록하는 공지 2개. author_seller_id는 initialize()에서
// SUPPORT_EMAIL로 가입된 계정을 조회해 채운다 (아래 목록엔 id가 없다).
const SEED_COMMUNITY_POSTS: Array<{
  id: string;
  category: "공지";
  title: string;
  content: string;
  createdAt: string;
}> = [
  {
    id: "cp-welcome",
    category: "공지",
    title: "커뮤니티를 열었습니다",
    createdAt: "2026-09-09T09:00:00.000Z",
    content:
      "안녕하세요, 툴허브입니다.\n\n" +
      "자유롭게 소통할 수 있는 커뮤니티를 열었습니다. 자유, 질문, 후기 카테고리로 편하게 글을 남겨주세요.\n\n" +
      "몇 가지 안내드립니다.\n" +
      "- 특정 매물에 대한 문의는 여기가 아니라 해당 매물 페이지를 통해 판매자에게 직접 연락해주세요.\n" +
      "- 플랫폼 자체(버그, 기능 제안 등)에 대한 의견은 '고객의 목소리' 페이지를 이용해주세요.\n" +
      "- 다른 이용자를 배려하는 글을 부탁드립니다. 부적절한 게시물은 신고를 통해 접수됩니다.\n\n" +
      "감사합니다.",
  },
  {
    id: "cp-tool-request-preview",
    category: "공지",
    title: "오픈했습니다 - 자동화 툴 의뢰 게시판",
    createdAt: "2026-09-09T09:05:00.000Z",
    content:
      "원하는 자동화 봇/스크립트를 직접 만들어달라고 요청할 수 있는 '자동화 툴 의뢰' 게시판이 열렸습니다.\n\n" +
      "이용 방법은 다음과 같습니다.\n" +
      "- 원하는 툴 내용과 사진, 예산을 함께 올려 의뢰를 등록합니다.\n" +
      "- 여러 개발자가 가격/기간/설명을 담아 제안을 보내오면, 의뢰자가 그중 하나를 선택합니다.\n" +
      "- 선택 이후에는 해당 제안의 비공개 스레드에서 개발자와 세부 사항을 조율합니다.\n" +
      "- 개발자가 완성본을 제출하면 기존 매물과 동일한 보안 스캔을 거쳐 전달되고, 의뢰자가 확인 후 결제를 완료하면 거래가 마무리됩니다.\n\n" +
      "지금 바로 '자동화 툴 의뢰' 메뉴 또는 /requests 에서 이용해보세요.",
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
  // 가입일(공개 프로필 "가입 N개월/년차" 표시용). 기존 계정은 이 컬럼이 없었으므로
  // 한 번만 지금 시각으로 채워 넣는다 - 실제 가입일이 아니지만, 없는 값을 지어내는
  // 대신 이 컬럼이 생긴 시점을 정직하게 기록하는 것이다. 이후 신규 가입은
  // createSeller가 매번 실제 가입 시각을 채운다.
  await sql`ALTER TABLE sellers ADD COLUMN IF NOT EXISTS created_at TEXT`;
  await sql`UPDATE sellers SET created_at = ${new Date().toISOString()} WHERE created_at IS NULL`;
  // 제작자 정산(직거래 이체 수신용) 계좌 정보. 본인이 직접 입력하고(휴대폰 인증·
  // 계좌 실명대조 없음), 노출은 getSellerById 등 일반 조회 함수에는 전혀 포함하지
  // 않고 lib/data.ts의 getSellerSettlementAccount(본인 전용)/
  // getSettlementAccountForViewer(의뢰인이 완성본을 수락한 뒤에만) 두 전용 함수를
  // 통해서만 읽는다.
  await sql`ALTER TABLE sellers ADD COLUMN IF NOT EXISTS settlement_bank_name TEXT`;
  await sql`ALTER TABLE sellers ADD COLUMN IF NOT EXISTS settlement_account_holder TEXT`;
  await sql`ALTER TABLE sellers ADD COLUMN IF NOT EXISTS settlement_account_number TEXT`;

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
      created_at TEXT NOT NULL,
      resend_count INTEGER NOT NULL DEFAULT 0,
      last_sent_at TEXT
    )
  `;
  // 기존(구버전) 테이블에 코드 입력 인증용 컬럼을 추가한다.
  await sql`ALTER TABLE email_verification_tokens ADD COLUMN IF NOT EXISTS code TEXT NOT NULL DEFAULT ''`;
  await sql`ALTER TABLE email_verification_tokens ADD COLUMN IF NOT EXISTS attempts INTEGER NOT NULL DEFAULT 0`;
  // 재발송 버튼 클릭 횟수/마지막 발송 시각 - 재발송 rate limit에 쓰인다
  // (회원가입 시 자동 최초 발송은 카운트하지 않음, lib/data.ts의
  // createResendVerificationToken 참고).
  await sql`ALTER TABLE email_verification_tokens ADD COLUMN IF NOT EXISTS resend_count INTEGER NOT NULL DEFAULT 0`;
  await sql`ALTER TABLE email_verification_tokens ADD COLUMN IF NOT EXISTS last_sent_at TEXT`;
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

  // 플랫폼 자체(버그/기능요청/기타)에 대한 로그인 유저 피드백. 매물/거래 관련
  // 문의와는 별개다 (app/feedback 페이지 참고).
  await sql`
    CREATE TABLE IF NOT EXISTS feedback_voices (
      id TEXT PRIMARY KEY,
      seller_id TEXT NOT NULL REFERENCES sellers(id),
      category TEXT NOT NULL,
      message TEXT NOT NULL,
      created_at TEXT NOT NULL
    )
  `;
  // 유저별 최근 제출 시각 조회(60초 재요청 제한)에 쓰인다.
  await sql`CREATE INDEX IF NOT EXISTS idx_feedback_voices_seller ON feedback_voices(seller_id, created_at DESC)`;

  // 커뮤니티 게시판. category='공지'는 운영자 계정만 작성 가능(앱 레벨 검증,
  // app/api/community/posts 참고). hidden은 신고 누적(5건)으로 자동 전환되며
  // 별도 복구 UI 없이 필요 시 DB에서 직접 되돌린다.
  await sql`
    CREATE TABLE IF NOT EXISTS community_posts (
      id TEXT PRIMARY KEY,
      author_seller_id TEXT NOT NULL REFERENCES sellers(id),
      category TEXT NOT NULL,
      title TEXT NOT NULL,
      content TEXT NOT NULL,
      hidden BOOLEAN NOT NULL DEFAULT FALSE,
      created_at TEXT NOT NULL
    )
  `;
  await sql`CREATE INDEX IF NOT EXISTS idx_community_posts_created ON community_posts(created_at DESC)`;
  await sql`CREATE INDEX IF NOT EXISTS idx_community_posts_category ON community_posts(category)`;

  await sql`
    CREATE TABLE IF NOT EXISTS community_comments (
      id TEXT PRIMARY KEY,
      post_id TEXT NOT NULL REFERENCES community_posts(id),
      author_seller_id TEXT NOT NULL REFERENCES sellers(id),
      content TEXT NOT NULL,
      hidden BOOLEAN NOT NULL DEFAULT FALSE,
      created_at TEXT NOT NULL
    )
  `;
  // 이미 community_comments가 생성된(hidden 컬럼 없이 배포된) DB에도 반영되도록 한다.
  await sql`ALTER TABLE community_comments ADD COLUMN IF NOT EXISTS hidden BOOLEAN NOT NULL DEFAULT FALSE`;
  await sql`CREATE INDEX IF NOT EXISTS idx_community_comments_post ON community_comments(post_id, created_at)`;

  await sql`
    CREATE TABLE IF NOT EXISTS community_post_reports (
      id TEXT PRIMARY KEY,
      post_id TEXT NOT NULL REFERENCES community_posts(id),
      reporter_seller_id TEXT NOT NULL REFERENCES sellers(id),
      created_at TEXT NOT NULL
    )
  `;
  await sql`
    CREATE UNIQUE INDEX IF NOT EXISTS idx_community_post_reports_unique
      ON community_post_reports(post_id, reporter_seller_id)
  `;

  // 댓글 신고도 게시글과 동일하게 5건 누적 시 자동으로 hidden 처리된다
  // (lib/data.ts의 reportCommunityComment 참고).
  await sql`
    CREATE TABLE IF NOT EXISTS community_comment_reports (
      id TEXT PRIMARY KEY,
      comment_id TEXT NOT NULL REFERENCES community_comments(id),
      reporter_seller_id TEXT NOT NULL REFERENCES sellers(id),
      created_at TEXT NOT NULL
    )
  `;
  await sql`
    CREATE UNIQUE INDEX IF NOT EXISTS idx_community_comment_reports_unique
      ON community_comment_reports(comment_id, reporter_seller_id)
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS tool_requests (
      id TEXT PRIMARY KEY,
      requester_seller_id TEXT NOT NULL REFERENCES sellers(id),
      title TEXT NOT NULL,
      description TEXT NOT NULL,
      budget_amount INTEGER,
      budget_negotiable BOOLEAN NOT NULL DEFAULT FALSE,
      desired_deadline TEXT,
      required_environment TEXT,
      reference_video_url TEXT,
      status TEXT NOT NULL DEFAULT 'open',
      created_at TEXT NOT NULL
    )
  `;
  await sql`CREATE INDEX IF NOT EXISTS idx_tool_requests_created ON tool_requests(created_at DESC)`;

  // listings보다 뒤에서 생성되므로 여기서 컬럼을 추가한다(순방향 참조 회피).
  await sql`ALTER TABLE listings ADD COLUMN IF NOT EXISTS source_request_id TEXT REFERENCES tool_requests(id)`;

  await sql`
    CREATE TABLE IF NOT EXISTS tool_request_images (
      id TEXT PRIMARY KEY,
      request_id TEXT NOT NULL REFERENCES tool_requests(id),
      image_url TEXT NOT NULL,
      sort_order INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL
    )
  `;
  await sql`CREATE INDEX IF NOT EXISTS idx_tool_request_images_request ON tool_request_images(request_id, sort_order)`;

  await sql`
    CREATE TABLE IF NOT EXISTS tool_proposals (
      id TEXT PRIMARY KEY,
      request_id TEXT NOT NULL REFERENCES tool_requests(id),
      seller_id TEXT NOT NULL REFERENCES sellers(id),
      price INTEGER NOT NULL,
      duration TEXT NOT NULL,
      description TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'pending',
      delivered_listing_id TEXT REFERENCES listings(id),
      delivery_confirmed_at TEXT,
      created_at TEXT NOT NULL
    )
  `;
  await sql`CREATE INDEX IF NOT EXISTS idx_tool_proposals_request ON tool_proposals(request_id, created_at)`;
  // 완성본 제출 시 제작자가 필수로 남기는 실행 가이드(설치/실행 방법).
  // FK가 아닌 단순 텍스트 컬럼이라 삭제 순서(deleteToolRequest)나 계정삭제
  // 크론에는 영향이 없다.
  await sql`ALTER TABLE tool_proposals ADD COLUMN IF NOT EXISTS delivery_guide TEXT`;
  // 완성본이 zip으로 제출된 경우, 스캔한 바로 그 zip을 private Blob에 저장한 URL.
  // listings.code_url을 재사용하지 않는다 - 그쪽은 마켓 재등록 등 다른 경로에서도
  // 조회/노출될 수 있는 필드라, 의뢰자 전용 다운로드 게이트로만 접근 가능한 이
  // 파일 URL과 노출 범위를 격리해야 한다. GitHub 제출이면 NULL.
  await sql`ALTER TABLE tool_proposals ADD COLUMN IF NOT EXISTS delivery_file_url TEXT`;
  // 제안의 완료 예정일(YYYY-MM-DD, tool_requests.desired_deadline과 동일한
  // TEXT 저장 관례). 기존 duration TEXT 컬럼은 타입을 바꾸지 않고 그대로
  // 두며, 이 컬럼은 새 제안부터만 채워진다 - 기존 제안은 NULL로 남고 화면에서
  // 조용히 생략된다(파싱/백필 없음).
  await sql`ALTER TABLE tool_proposals ADD COLUMN IF NOT EXISTS proposed_completion_date TEXT`;

  // 아래 5개 컬럼은 "에스크로 없는 직거래 결제/정산" 흐름의 단계별 시각을
  // 기록한다. 병렬 상태 테이블을 새로 두지 않고 기존 delivery_confirmed_at
  // (스캔 게이트 통과) 뒤를 잇는 타임스탬프로만 표현한다.
  //   제출+스캔 통과(delivery_confirmed_at) → 의뢰인 수락(buyer_accepted_at)
  //   → 의뢰인 이체 완료 표시(transfer_marked_at) → 제작자 입금 확인
  //   (payment_confirmed_at, 이 시점에만 tool_requests.status가 completed로
  //   바뀌고 완성본 다운로드가 열린다). 재제출(재스캔) 시에는 아래에서
  //   clearProposalDeliveryConfirmation이 이 3개도 함께 초기화한다 - 새로
  //   제출된 완성본이 이전 수락/이체 상태를 그대로 물려받지 않도록.
  await sql`ALTER TABLE tool_proposals ADD COLUMN IF NOT EXISTS buyer_accepted_at TEXT`;
  await sql`ALTER TABLE tool_proposals ADD COLUMN IF NOT EXISTS transfer_marked_at TEXT`;
  await sql`ALTER TABLE tool_proposals ADD COLUMN IF NOT EXISTS payment_confirmed_at TEXT`;
  // 의뢰인이 "이체 완료" 표시 시 선택적으로 첨부하는 이체 증빙 스크린샷(private Blob URL).
  await sql`ALTER TABLE tool_proposals ADD COLUMN IF NOT EXISTS transfer_proof_url TEXT`;
  // 완성본 제출 시 작동 증빙으로 첨부하는 짧은 영상(선택, private Blob URL).
  // 스크린샷은 별도 테이블(tool_proposal_delivery_proofs, 1장 이상)에 보관한다.
  await sql`ALTER TABLE tool_proposals ADD COLUMN IF NOT EXISTS delivery_proof_video_url TEXT`;

  // 이 5개 컬럼이 생기기 전에 이미 완료(tool_requests.status='completed')까지
  // 간 거래는 결제 확인 단계 자체가 없었으므로, 새 게이트(payment_confirmed_at
  // 없으면 다운로드 불가)가 그 기존 거래를 회귀시키지 않도록 완료 시점을 그대로
  // 백필한다. 신규/진행중 거래는 delivery_confirmed_at은 있어도 status가
  // completed가 아니므로 이 조건에 걸리지 않는다.
  await sql`
    UPDATE tool_proposals
    SET buyer_accepted_at = COALESCE(buyer_accepted_at, delivery_confirmed_at),
        transfer_marked_at = COALESCE(transfer_marked_at, delivery_confirmed_at),
        payment_confirmed_at = COALESCE(payment_confirmed_at, delivery_confirmed_at)
    WHERE payment_confirmed_at IS NULL
      AND delivery_confirmed_at IS NOT NULL
      AND status = 'selected'
      AND request_id IN (SELECT id FROM tool_requests WHERE status = 'completed')
  `;

  // 완성본 제출 시 첨부하는 작동 증빙 스크린샷(1장 이상). tool_request_images와
  // 동일한 패턴(부모별 다건, sort_order로 순서 유지)이다. 당사자(의뢰인/선택된
  // 제작자) 한정 게이트 라우트(app/api/requests/[requestId]/delivery/asset)를
  // 통해서만 조회되며, 다른 조회 함수는 이 테이블을 읽지 않는다.
  await sql`
    CREATE TABLE IF NOT EXISTS tool_proposal_delivery_proofs (
      id TEXT PRIMARY KEY,
      proposal_id TEXT NOT NULL REFERENCES tool_proposals(id),
      image_url TEXT NOT NULL,
      sort_order INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL
    )
  `;
  await sql`
    CREATE INDEX IF NOT EXISTS idx_tool_proposal_delivery_proofs_proposal
      ON tool_proposal_delivery_proofs(proposal_id, sort_order)
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS tool_proposal_messages (
      id TEXT PRIMARY KEY,
      proposal_id TEXT NOT NULL REFERENCES tool_proposals(id),
      sender_seller_id TEXT NOT NULL REFERENCES sellers(id),
      content TEXT NOT NULL,
      created_at TEXT NOT NULL
    )
  `;
  await sql`CREATE INDEX IF NOT EXISTS idx_tool_proposal_messages_proposal ON tool_proposal_messages(proposal_id, created_at)`;

  for (const seller of SEED_SELLERS) {
    await sql`
      INSERT INTO sellers (id, nickname, contact, created_at)
      VALUES (${seller.id}, ${seller.nickname}, ${seller.contact}, ${seller.createdAt})
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

  // 운영자(SUPPORT_EMAIL로 가입된 계정) 명의의 공지 시드 - 고정 id + ON CONFLICT DO NOTHING으로
  // 여러 번 실행돼도 중복 삽입되지 않는다. 운영자가 아직 가입 전이면(초기 배포 등) 조용히 건너뛴다.
  const operatorRows = (await sql`
    SELECT id FROM sellers WHERE email = ${SUPPORT_EMAIL}
  `) as Array<{ id: string }>;
  const operatorId = operatorRows[0]?.id;

  if (operatorId) {
    for (const post of SEED_COMMUNITY_POSTS) {
      // "cp-tool-request-preview"는 툴 의뢰 게시판 오픈 전에 이미 프로덕션에 배포되었던
      // 예고 공지라, 문구를 갱신한 뒤에도 DO NOTHING이면 기존 행이 고쳐지지 않는다.
      // 이 한 건만 title/content를 최신 내용으로 덮어쓰도록 upsert한다.
      if (post.id === "cp-tool-request-preview") {
        await sql`
          INSERT INTO community_posts (id, author_seller_id, category, title, content, hidden, created_at)
          VALUES (
            ${post.id}, ${operatorId}, ${post.category}, ${post.title},
            ${post.content}, false, ${post.createdAt}
          )
          ON CONFLICT (id) DO UPDATE SET
            title = EXCLUDED.title,
            content = EXCLUDED.content
        `;
        continue;
      }
      await sql`
        INSERT INTO community_posts (id, author_seller_id, category, title, content, hidden, created_at)
        VALUES (
          ${post.id}, ${operatorId}, ${post.category}, ${post.title},
          ${post.content}, false, ${post.createdAt}
        )
        ON CONFLICT (id) DO NOTHING
      `;
    }
  }
}
