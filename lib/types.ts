export type ScanResult = {
  hasHardcodedSecret: boolean;
  hasVulnerableDependency: boolean;
  scannedAt: string;
  passed: boolean;
  findings: string[];
  suggestions: string[];
};

export type Seller = {
  id: string;
  nickname: string;
  contact: string;
};

export const CATEGORIES = [
  "크롤러/스크래퍼",
  "업무 자동화(RPA)",
  "알림/모니터링 봇",
  "트레이딩 봇",
  "SNS/마케팅 자동화",
  "기타",
] as const;

export type Category = (typeof CATEGORIES)[number];

export type Listing = {
  id: string;
  title: string;
  description: string;
  price: number;
  category: Category;
  codeUrl: string;
  scanResult: ScanResult | null;
  isVerified: boolean;
  createdAt: string;
  sellerId: string;
};
