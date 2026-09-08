export type Seller = {
  id: string;
  nickname: string;
  contact: string;
  email: string | null;
  emailVerified: boolean;
  deletionRequestedAt: string | null;
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

export const SOURCE_TYPES = ["github", "zip"] as const;
export type SourceType = (typeof SOURCE_TYPES)[number];

export type ScanStatus = "pending" | "completed";

export type Listing = {
  id: string;
  title: string;
  description: string;
  price: number;
  category: Category;
  codeUrl: string | null;
  sourceType: SourceType;
  published: boolean;
  scanStatus: ScanStatus;
  disclosureNote: string | null;
  hasUnresolvedFindings: boolean;
  createdAt: string;
  sellerId: string;
};

export const SEVERITIES = ["critical", "high", "medium", "low", "informational"] as const;
export type Severity = (typeof SEVERITIES)[number];

// Medium 이상은 게시 전 작성자 확인이 필요한 등급입니다.
export const BLOCKING_SEVERITIES: Severity[] = ["critical", "high", "medium"];

export const CONFIDENCE_LEVELS = ["high", "medium", "low"] as const;
export type Confidence = (typeof CONFIDENCE_LEVELS)[number];

export type Finding = {
  id: string;
  severity: Severity;
  confidence: Confidence;
  type: string;
  cwe: string;
  filePath: string;
  location: string | null;
  maskedEvidence: string | null;
  description: string;
};

export type ScanReport = {
  id: string;
  listingId: string;
  authorId: string;
  findings: Finding[];
  createdAt: string;
  ruleEngineVersion: string;
};
