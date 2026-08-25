import "server-only";
import type { Listing, Seller } from "./types";

// 아직 DB가 없어서 메모리에 더미 데이터를 둡니다.
// 서버 재시작 시 초기화되며, 실제 저장소로 교체될 예정입니다.

const sellers: Seller[] = [
  { id: "s1", nickname: "봇공작소", contact: "open.kakao.com/o/gBotFactory" },
  { id: "s2", nickname: "크롤킹", contact: "crawlking@example.com" },
  { id: "s3", nickname: "야매개발자", contact: "@yamae_dev (텔레그램)" },
];

const listings: Listing[] = [
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

export async function getListings(): Promise<Listing[]> {
  return [...listings].sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
}

export async function getListingById(id: string): Promise<Listing | null> {
  return listings.find((listing) => listing.id === id) ?? null;
}

export async function getSellerById(id: string): Promise<Seller | null> {
  return sellers.find((seller) => seller.id === id) ?? null;
}

export async function addListing(
  input: Omit<
    Listing,
    "id" | "createdAt" | "scanResult" | "isVerified" | "sellerId"
  >
): Promise<Listing> {
  const listing: Listing = {
    ...input,
    id: `l${listings.length + 1}-${Date.now()}`,
    createdAt: new Date().toISOString(),
    scanResult: null,
    isVerified: false,
    // 아직 로그인/판매자 프로필이 없어 임시로 첫 판매자에게 귀속시킵니다.
    sellerId: sellers[0].id,
  };
  listings.unshift(listing);
  return listing;
}

export async function updateListingScanResult(
  id: string,
  scanResult: Listing["scanResult"]
): Promise<void> {
  const listing = listings.find((item) => item.id === id);
  if (!listing) return;
  listing.scanResult = scanResult;
  listing.isVerified = scanResult?.passed ?? false;
}
