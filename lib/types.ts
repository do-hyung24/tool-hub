export type Seller = {
  id: string;
  nickname: string;
  contact: string;
  email: string | null;
  emailVerified: boolean;
  deletionRequestedAt: string | null;
  profileImageUrl: string | null;
  createdAt: string;
};

// /sellers/[id] 공개 프로필용 집계 - 이메일 등 비공개 정보는 절대 포함하지 않는다.
export type SellerPublicProfile = {
  sellerId: string;
  nickname: string;
  profileImageUrl: string | null;
  createdAt: string;
  completedAsMaker: number;
  inProgressAsMaker: number;
  // 계산은 남겨두되 UI(/sellers/[id])에는 노출하지 않는다 - 표본이 작을 때
  // 오해를 주고, '고지 후 그대로 전달'이라는 정당한 경로를 실패로 낙인찍는
  // 지표라 공개 지표로는 부적절하다고 판단했다.
  // 완료 실적이 0건이면 계산할 표본이 없어 null(집계 불가 - "0% 통과"와 구분).
  scanPassRate: number | null;
  publishedListings: Array<{
    id: string;
    title: string;
    scanStatus: Listing["scanStatus"];
  }>;
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
  sourceRequestId: string | null;
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

export const FEEDBACK_CATEGORIES = ["버그", "기능요청", "기타"] as const;
export type FeedbackCategory = (typeof FEEDBACK_CATEGORIES)[number];

export type FeedbackVoice = {
  id: string;
  sellerId: string;
  category: FeedbackCategory;
  message: string;
  createdAt: string;
};

// '공지'는 운영자 계정만 작성 가능 (app/api/community/posts에서 검증).
export const USER_COMMUNITY_CATEGORIES = ["자유", "질문", "후기"] as const;
export const COMMUNITY_CATEGORIES = [...USER_COMMUNITY_CATEGORIES, "공지"] as const;
export type CommunityCategory = (typeof COMMUNITY_CATEGORIES)[number];

export type CommunityPost = {
  id: string;
  authorSellerId: string;
  category: CommunityCategory;
  title: string;
  content: string;
  hidden: boolean;
  createdAt: string;
};

export type CommunityPostWithAuthor = CommunityPost & {
  authorNickname: string;
  authorProfileImageUrl: string | null;
};

export type CommunityComment = {
  id: string;
  postId: string;
  authorSellerId: string;
  content: string;
  hidden: boolean;
  createdAt: string;
};

export type CommunityCommentWithAuthor = CommunityComment & {
  authorNickname: string;
  authorProfileImageUrl: string | null;
};

export const TOOL_REQUEST_STATUSES = ["open", "in_progress", "completed"] as const;
export type ToolRequestStatus = (typeof TOOL_REQUEST_STATUSES)[number];

export type ToolRequest = {
  id: string;
  requesterSellerId: string;
  title: string;
  description: string;
  budgetAmount: number | null;
  budgetNegotiable: boolean;
  desiredDeadline: string | null;
  requiredEnvironment: string | null;
  referenceVideoUrl: string | null;
  status: ToolRequestStatus;
  createdAt: string;
};

export type ToolRequestWithAuthor = ToolRequest & {
  requesterNickname: string;
};

export type ToolRequestImage = {
  id: string;
  requestId: string;
  imageUrl: string;
  sortOrder: number;
  createdAt: string;
};

export const TOOL_PROPOSAL_STATUSES = ["pending", "selected"] as const;
export type ToolProposalStatus = (typeof TOOL_PROPOSAL_STATUSES)[number];

export type ToolProposal = {
  id: string;
  requestId: string;
  sellerId: string;
  price: number;
  duration: string;
  description: string;
  status: ToolProposalStatus;
  deliveredListingId: string | null;
  deliveryConfirmedAt: string | null;
  deliveryGuide: string | null;
  deliveryFileUrl: string | null;
  proposedCompletionDate: string | null;
  // 직거래 결제/정산 흐름(에스크로 없음)의 단계별 시각. delivery_confirmed_at
  // (스캔 게이트 통과) 다음을 잇는다: 의뢰인 수락(buyerAcceptedAt) → 의뢰인
  // 이체 완료 표시(transferMarkedAt, 선택적으로 transferProofUrl 첨부) → 제작자
  // 입금 확인(paymentConfirmedAt, 이 시점에만 완성본 다운로드가 열린다).
  buyerAcceptedAt: string | null;
  transferMarkedAt: string | null;
  transferProofUrl: string | null;
  paymentConfirmedAt: string | null;
  // 완성본 제출 시 작동 증빙으로 첨부하는 짧은 영상(선택). 스크린샷은
  // ToolProposalDeliveryProof(1장 이상)로 별도 보관한다.
  deliveryProofVideoUrl: string | null;
  createdAt: string;
};

// 완성본 제출 시 작동 증빙으로 첨부하는 스크린샷. ToolRequestImage와 동일한
// 모양(부모별 다건 + sortOrder)이다.
export type ToolProposalDeliveryProof = {
  id: string;
  proposalId: string;
  imageUrl: string;
  sortOrder: number;
  createdAt: string;
};

// 제작자 정산 계좌 - 민감정보라 Seller 타입에 넣지 않고 전용 함수(lib/data.ts의
// getSellerSettlementAccount/getSettlementAccountForViewer)로만 조회한다.
export type SellerSettlementAccount = {
  bankName: string | null;
  accountHolder: string | null;
  accountNumber: string | null;
};

export type ToolProposalWithAuthor = ToolProposal & {
  sellerNickname: string;
  sellerProfileImageUrl: string | null;
};

// /my(내 활동 대시보드) 전용 요약 타입 - 상태별 분류는 페이지 쪽에서 status
// 필드를 보고 나눈다(데이터 함수는 분류하지 않고 평평한 목록만 반환).
export type MyRequestSummary = {
  id: string;
  title: string;
  status: ToolRequestStatus;
  desiredDeadline: string | null;
  proposalCount: number;
  createdAt: string;
};

export type MyWorkSummary = {
  requestId: string;
  proposalId: string;
  requestTitle: string;
  requestStatus: ToolRequestStatus;
  desiredDeadline: string | null;
  myProposalStatus: ToolProposalStatus;
  price: number;
  duration: string;
  proposedCompletionDate: string | null;
  createdAt: string;
};

export type ToolProposalMessage = {
  id: string;
  proposalId: string;
  senderSellerId: string;
  content: string;
  createdAt: string;
};

export type ToolProposalMessageWithAuthor = ToolProposalMessage & {
  senderNickname: string;
};
