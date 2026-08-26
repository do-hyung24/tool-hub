import "server-only";
import { neon, type NeonQueryFunction } from "@neondatabase/serverless";
import type { Listing, Seller } from "./types";

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

const SEED_SELLERS: Seller[] = [
  { id: "s1", nickname: "봇공작소", contact: "open.kakao.com/o/gBotFactory" },
  { id: "s2", nickname: "크롤킹", contact: "crawlking@example.com" },
  { id: "s3", nickname: "야매개발자", contact: "@yamae_dev (텔레그램)" },
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
    scanResult: {
      hasHardcodedSecret: false,
      hasVulnerableDependency: false,
      scannedAt: "2026-08-20T09:00:00.000Z",
      passed: true,
      findings: [],
      suggestions: [],
    },
    isVerified: true,
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
    scanResult: {
      hasHardcodedSecret: true,
      hasVulnerableDependency: false,
      scannedAt: "2026-08-18T09:00:00.000Z",
      passed: false,
      findings: ["설정 파일에 네이버 API 키가 하드코딩되어 있습니다."],
      suggestions: ["API 키는 환경변수로 분리하고, 저장소에는 예시 값만 남겨주세요."],
    },
    isVerified: false,
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
    scanResult: {
      hasHardcodedSecret: false,
      hasVulnerableDependency: false,
      scannedAt: "2026-08-22T09:00:00.000Z",
      passed: true,
      findings: [],
      suggestions: [],
    },
    isVerified: true,
    createdAt: "2026-08-22T09:00:00.000Z",
    sellerId: "s3",
  },
];

let initPromise: Promise<void> | null = null;

// 앱이 처음 DB에 접근할 때 딱 한 번만 테이블 생성 + 시드 삽입을 수행한다.
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
      contact TEXT NOT NULL
    )
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS listings (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      description TEXT NOT NULL,
      price INTEGER NOT NULL,
      category TEXT NOT NULL,
      code_url TEXT NOT NULL,
      scan_result JSONB,
      is_verified BOOLEAN NOT NULL DEFAULT FALSE,
      created_at TEXT NOT NULL,
      seller_id TEXT NOT NULL REFERENCES sellers(id)
    )
  `;

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
        id, title, description, price, category, code_url,
        scan_result, is_verified, created_at, seller_id
      )
      VALUES (
        ${listing.id}, ${listing.title}, ${listing.description}, ${listing.price},
        ${listing.category}, ${listing.codeUrl},
        ${listing.scanResult ? JSON.stringify(listing.scanResult) : null},
        ${listing.isVerified}, ${listing.createdAt}, ${listing.sellerId}
      )
      ON CONFLICT (id) DO NOTHING
    `;
  }
}
