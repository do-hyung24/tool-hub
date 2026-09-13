# 자동화 툴 의뢰(맞춤제작 요청) 게시판 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 의뢰자가 사진 첨부와 함께 자동화 업무를 "의뢰"로 올리고, 판매자(개발자)가 가격/기간/설명으로 "제안"을 넣으면, 의뢰자가 하나를 선택해 비공개 스레드로 세부 조율 후, 선택된 판매자가 완성본을 제출하면 기존 스캔 파이프라인을 그대로 태워 검사받고, 의뢰자 확인 후 더미 결제로 거래를 완료하는 독립 섹션(`app/requests`)을 추가한다. 기존 매물 마켓/커뮤니티는 항목 0(헤더)을 제외하고 전혀 건드리지 않는다.

**Architecture:** Next.js 16 App Router + NextAuth v5(JWT, Credentials) + `@neondatabase/serverless`(raw SQL, ORM 없음, 트랜잭션 없음) + Vercel Blob(`@vercel/blob`) + Resend(`resend`). 스키마는 `lib/db.ts`의 `initialize()` 안에 `CREATE TABLE IF NOT EXISTS` / `ALTER TABLE ... ADD COLUMN IF NOT EXISTS`로 추가한다(별도 migrations 디렉터리 없음). 모든 DB 접근은 `lib/data.ts`를 거친다. 이 기능은 두 가지 기존 패턴을 상황에 맞게 나눠 재사용한다:
- **커뮤니티 패턴**(가벼운 CRUD/소셜 상호작용 — 의뢰 열람 목록, 제안 작성, 제안 선택, 비공개 스레드 메시지): `app/api/**/route.ts` API 라우트 + 클라이언트 컴포넌트의 `fetch` + `router.refresh()`.
- **매물 등록 패턴**(파일 업로드 + 보안 스캔이 필요한 무거운 흐름 — 완성본 제출): `"use server"` 서버 액션(`app/actions.ts`와 나란한 새 파일 `app/requestActions.ts`) + 폼 `action={...}` 바인딩, `app/actions.ts`의 `collectFilesForSource`/`parseSourceType`을 export해서 재사용.

**핵심 설계 결정 (모호했던 지점 확정)**
1. **"게시" ≠ "공개 마켓 노출".** `createListingAction`이 하는 "게시(publish)"는 `listings.published=true`를 의미하며 이는 곧바로 홈/`getListings()` 공개 마켓에 노출된다는 뜻이다. 스펙은 "완성본은 기본적으로 그 의뢰자에게만 전달"이라고 명시하므로, 의뢰 납품용으로 생성되는 `listings` 행은 **스캔·리뷰 로직만 재사용**하고 `published`는 계속 `false`로 둔다(공개 마켓에 나타나지 않음). **여기서 "납품물"의 판별 기준은 `source_request_id IS NOT NULL`이 아니라 "어떤 `tool_proposals.delivered_listing_id`가 이 행을 가리키고 있는지"다** — Task 8의 마켓 재등록으로 만들어지는 새 행도 출처 표시용으로 `source_request_id`를 채우지만 그 행은 어떤 제안도 가리키지 않으므로 정상적으로 `published=true`가 되는 것이 맞다. 이 불변식은 `lib/data.ts`의 `publishListing`이 `WHERE ... AND NOT EXISTS (SELECT 1 FROM tool_proposals WHERE delivered_listing_id = listings.id)`로 강제한다(기존 IDOR 가드와 동일한 WHERE 절 스타일 — 조건에 걸리면 0행이 갱신되고 `null`이 반환된다). 따라서 `app/requestActions.ts`가 `publishListing`을 호출하지 않는다는 사실에만 기대지 않고, 다른 경로(`rescanListingAction`/`publishAnywayAction` 등)가 납품 리스팅 id로 들어와도 게시되지 않는다. "스캔 통과(findings 없음, 또는 findings 있어도 판매자가 그대로 게시 선택)" 시점은 `listings.published`가 아니라 `tool_proposals.delivered_listing_id`(제출됨) + `tool_proposals.delivery_confirmed_at`(스캔 게이트 통과·의뢰자에게 알림 발송됨)로 표현한다. 판매자가 "매물로도 등록하기"를 누르면 `/listings/new`를 통해 **완전히 별개의 새 `listings` 행**을 만든다(재등록 = 새 행, 기존 납품 행의 `published`를 뒤늦게 true로 바꾸는 게 아니다).
2. **`app/listings/[id]/page.tsx`는 건드리지 않는다.** `getListingById()`가 이미 `published = true`만 반환하므로(미게시 매물은 404), 의뢰자가 납품물을 확인하는 화면은 `/listings/[id]`를 재사용하지 않고 `app/requests/[requestId]/page.tsx` 안에 스캔 리포트 요약을 직접 표시한다(전용 조회 함수, 소유권 체크 포함).
   - **이 스캔 요약 블록의 열람 권한은 의뢰 상세 페이지 자체(누구나 열람 가능, 제안을 넣으려는 다른 판매자들이 둘러보는 공개 페이지)와 별개다.** 의뢰 상세 페이지는 그대로 공개이되, 그 안의 "납품 스캔 요약" 블록만 **의뢰자 본인 OR 선택된(`tool_proposals.status='selected'`) 제안의 판매자 본인**에게만 렌더링하고, 그 외(제안을 안 넣었거나 선택되지 않은 다른 판매자, 비로그인 방문자)에게는 그 블록 자체를 아예 내려주지 않는다(조건부 렌더링이 아니라 서버 컴포넌트에서 조회 함수 자체를 그 두 역할일 때만 호출). 단, **"확인 및 결제(더미) 완료하기" 버튼은 의뢰자 본인에게만** 보인다(선택된 판매자는 요약을 볼 수는 있지만 결제 확인은 못 한다).
3. **`sellers` 테이블을 의뢰자/판매자 공통으로 그대로 재사용**한다(스펙 지시). "구매자"라는 단어는 이 기능 전체 문구에서 쓰지 않는다.
4. **`tool_proposals.status`만으로 선택 여부를 표현**한다(`'pending' | 'selected'`). `tool_requests.status`(`'open' | 'in_progress' | 'completed'`)와 별개 필드이며, 순환 FK(`tool_requests` ↔ `tool_proposals`)를 피하기 위해 `tool_requests`에는 "선택된 제안 id" 컬럼을 두지 않는다 — 필요하면 `tool_proposals WHERE request_id=? AND status='selected'`로 조회한다.
5. **동영상은 링크 텍스트 1줄만** 받는다(업로드 없음). 사진은 의뢰 게시판 성격상 판매자 전원에게 공개돼야 하는 정보라 원래 `access:"public"` Blob(프록시 라우트 불필요)을 의도했으나, **Task 3 구현 중 확인된 실제 환경 제약**: 이 프로젝트가 실제로 쓰는 Vercel Blob 스토어가 private 전용으로 구성되어 있어 `access:"public"`로의 업로드 자체가 API 레벨에서 거부된다(`Cannot use public access on a private store`). 따라서 저장은 `access:"private"`로 하되, 프로필 사진 프록시(`app/api/profile/image/[sellerId]/route.ts`)와 동일한 서버측 스트리밍 프록시를 하나 더 두되 **로그인/소유권 체크는 하지 않는다**(내용 자체가 공개 정보이므로) — `GET /api/requests/images/[imageId]`가 `tool_request_images`에서 `image_url`을 찾아 그대로 스트리밍하고, `Cache-Control`은 프로필 사진의 `private, no-store`가 아니라 `public, max-age=31536000, immutable`로 설정한다(매 업로드가 새 랜덤 파일명을 쓰므로 캐시 무효화 걱정 없음). `<img src>`는 이 프록시 URL을 가리킨다.

**Tech Stack:** Next.js 16(App Router, Server Actions), NextAuth v5(Credentials, JWT), `@neondatabase/serverless`, `@vercel/blob`, `sharp`, `file-type`, `resend`, `vitest`.

**Spec:** 이 대화에서 사용자가 준 한국어 스펙 전문이 이 문서의 유일한 원본이다. 요약이 아니라 스펙 원문 기준으로 각 Task를 검증할 것.

## Global Constraints

- 기존 `listings`/`community_*`/인증/세션/결제 관련 기존 동작은 **항목 0(헤더)을 제외하고** 변경하지 않는다. 특히 `getListingById`, `getListings`, `publishListing`, `createListingAction`의 기존 분기(스캔 → 없으면 자동 게시 → 있으면 review) 자체는 수정하지 않고, 새 파라미터를 **추가**하는 형태로만 확장한다.
- 새 테이블은 `lib/db.ts`의 `initialize()` 안에 `CREATE TABLE IF NOT EXISTS`로 추가하고, 날짜 컬럼은 전부 `TEXT`(ISO 문자열)로 저장한다(이 스키마의 다른 모든 날짜 컬럼과 동일). 트랜잭션은 쓰지 않는다(이 코드베이스 전체가 순차 `await sql\`...\`` 스타일).
- 소유권/권한 체크는 반드시 SQL `WHERE`절에 seller_id/requester_seller_id를 함께 걸어 IDOR을 막는 기존 스타일(`getListingForOwner`, `publishListing`)을 그대로 따른다. 클라이언트가 보낸 id만 믿고 권한을 우회할 수 있는 코드를 만들지 않는다.
- 이미지 업로드는 `app/api/profile/upload-image/route.ts`의 검증 순서(SVG 차단 → 크기 제한 2MB → magic-byte 확인 → sharp 리사이즈/재인코딩)를 그대로 따르되, 다음 차이를 반영한다: 여러 장 허용, `access:"private"` + 인증 없는 공개 프록시 라우트(이 환경의 Blob 스토어가 private 전용이라 `access:"public"` 업로드가 거부됨 — 설계 결정 5 갱신 내용 참고), 리사이즈는 아바타처럼 정사각형 크롭이 아니라 원본 비율 유지 + 최대 변 길이 제한(예: 1600px) 정도로 조정.
- Vitest는 DB/네트워크를 타는 코드를 테스트하지 않는 기존 관례(`vitest.config.ts`의 `include: ["lib/**/*.test.ts"]`, 순수 로직만 유닛테스트)를 따른다 — 이 기능도 DB 호출부는 수동 검증(dev 서버 + 실제 DB)으로 확인하고, 새로 순수 로직(예: 참고 영상 URL 형식 검증 함수)을 뽑아낸 경우에만 `*.test.ts`를 추가한다.
- 커밋 메시지는 매 Task 끝에 아래 attribution을 포함한다:
  ```
  Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
  Claude-Session: https://claude.ai/code/session_01B6X9M3vg7J53gqTLvgiwpm
  ```

---

### Task 1: 데이터 모델 (스키마 + 타입)

**Files:**
- Modify: `lib/db.ts`, `lib/types.ts`

**Interfaces:**
- Produces: 테이블 `tool_requests`, `tool_request_images`, `tool_proposals`, `tool_proposal_messages`; `listings.source_request_id` 컬럼; 타입 `ToolRequestStatus`, `ToolRequest`, `ToolRequestImage`, `ToolProposalStatus`, `ToolProposal`, `ToolProposalMessage` — Task 2 이하 전부가 이걸 가져다 쓴다.

- [ ] **Step 1: `lib/db.ts`의 `initialize()` 끝(커뮤니티 테이블들 뒤, 시드 삽입 앞)에 새 테이블 추가**

```sql
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
);
CREATE INDEX IF NOT EXISTS idx_tool_requests_created ON tool_requests(created_at DESC);

-- listings보다 뒤에서 생성되므로 여기서 컬럼을 추가한다(순방향 참조 회피).
ALTER TABLE listings ADD COLUMN IF NOT EXISTS source_request_id TEXT REFERENCES tool_requests(id);

CREATE TABLE IF NOT EXISTS tool_request_images (
  id TEXT PRIMARY KEY,
  request_id TEXT NOT NULL REFERENCES tool_requests(id),
  image_url TEXT NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_tool_request_images_request ON tool_request_images(request_id, sort_order);

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
);
CREATE INDEX IF NOT EXISTS idx_tool_proposals_request ON tool_proposals(request_id, created_at);

CREATE TABLE IF NOT EXISTS tool_proposal_messages (
  id TEXT PRIMARY KEY,
  proposal_id TEXT NOT NULL REFERENCES tool_proposals(id),
  sender_seller_id TEXT NOT NULL REFERENCES sellers(id),
  content TEXT NOT NULL,
  created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_tool_proposal_messages_proposal ON tool_proposal_messages(proposal_id, created_at);
```

주의: `tool_requests`가 먼저 만들어져야 `listings.source_request_id`의 `REFERENCES`가 성립한다 — 위 순서(테이블 생성 → 곧바로 ALTER) 그대로 따를 것.

- [ ] **Step 2: `lib/types.ts`에 타입 추가**

```ts
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
  createdAt: string;
};

export type ToolProposalWithAuthor = ToolProposal & {
  sellerNickname: string;
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
```

주의: `Listing` 타입 자체에 `sourceRequestId` 필드를 추가하는 작업은 **이 Task에서 하지 않는다** — `lib/data.ts`의 `rowToListing`/`ListingRow`/`createDraftListing`을 같은 커밋에서 함께 고치지 않으면 그 순간 `rowToListing`이 `Listing` 타입을 만족하지 못해 타입 에러가 난다. 필드 추가와 매핑 갱신은 전부 Task 2에서 한 번에 한다(이 Task는 새 테이블 4개용 독립 타입만 추가).

- [ ] **Step 3: Typecheck** — `npx tsc --noEmit` (새 타입은 아직 아무 파일도 참조하지 않고, `Listing` 타입은 이 Task에서 손대지 않으므로 에러 없어야 함)
- [ ] **Step 4: Commit** (`git add lib/db.ts lib/types.ts`)

---

### Task 2: 데이터 레이어 (`lib/data.ts`)

**Files:** Modify: `lib/data.ts`

**Interfaces:**
- Consumes: Task 1의 테이블/타입.
- Produces: 아래 함수들 — Task 3~9가 전부 이걸 통해서만 DB에 접근한다(직접 SQL 금지, 기존 관례 그대로).

`lib/types.ts`의 `Listing` 타입에 `sourceRequestId: string | null;` 필드를 추가하고(기존 필드들 사이 아무 위치), 같은 커밋 안에서 `lib/data.ts`의 `ListingRow`/`rowToListing`/`createDraftListing`에 `source_request_id`/`sourceRequestId`를 추가로 매핑한다 — 타입 추가와 매핑 갱신을 분리하면 그 사이 `rowToListing`이 `Listing`을 만족하지 못해 타입 에러가 나므로 반드시 한 번에 같이 고칠 것(커밋 전 `getListings`/`getListingById`가 깨지지 않는지 확인).

```ts
// createDraftListing 시그니처에 sourceRequestId 추가 (기존 호출부는 undefined로 자동 처리되도록 optional)
export async function createDraftListing(input: {
  title: string; description: string; price: number; category: Category;
  codeUrl: string | null; sourceType: SourceType; sellerId: string;
  sourceRequestId?: string | null; // 추가
}): Promise<Listing> { ... }
```

의뢰 CRUD — community 패턴(`createCommunityPost`/`listCommunityPosts`/`getCommunityPostById`)과 동일한 모양:
- `createToolRequest(input: { requesterSellerId, title, description, budgetAmount, budgetNegotiable, desiredDeadline, requiredEnvironment, referenceVideoUrl }): Promise<ToolRequest>`
- `addToolRequestImages(requestId: string, imageUrls: string[]): Promise<void>` — `sort_order`는 배열 인덱스로 채움. 여러 장을 한 번에 저장(순차 insert, 트랜잭션 없음 — 기존 스타일).
- `listToolRequests(input: { page: number; pageSize: number }): Promise<{ requests: ToolRequestWithAuthor[]; total: number }>` — `JOIN sellers`로 `requester_nickname` 포함, `ORDER BY created_at DESC`. (카테고리 필터는 없음 — 이 게시판은 단일 유형.)
- `getToolRequestById(id: string): Promise<ToolRequestWithAuthor | null>`
- `listToolRequestImages(requestId: string): Promise<ToolRequestImage[]>` — `ORDER BY sort_order ASC`.

제안 CRUD:
- `createToolProposal(input: { requestId, sellerId, price, duration, description }): Promise<ToolProposal>` — 호출부(API 라우트)에서 미리 `request.status === 'open'` 확인 후 호출.
- `listToolProposalsForRequest(requestId: string): Promise<ToolProposalWithAuthor[]>` — `JOIN sellers`로 `seller_nickname` 포함, `ORDER BY created_at ASC`.
- `getToolProposalById(id: string): Promise<ToolProposal | null>`
- `selectToolProposal(requestId: string, proposalId: string, requesterSellerId: string): Promise<boolean>` — `reportCommunityPost`처럼 원자적으로: `UPDATE tool_requests SET status='in_progress' WHERE id=$1 AND requester_seller_id=$2 AND status='open' RETURNING id`로 먼저 요청 상태를 잠그고(0행이면 이미 처리됐거나 권한 없음 → false 반환), 성공하면 `UPDATE tool_proposals SET status='selected' WHERE id=$3 AND request_id=$1`. 나머지 제안들의 status는 건드리지 않는다(설계 결정 4 참고 — UI에서 `request.status !== 'open'`이면 "선택 마감"으로 표시).

납품/스캔 연동:
- `markProposalDelivered(proposalId: string, listingId: string): Promise<void>` — `tool_proposals.delivered_listing_id` 설정.
- `confirmProposalDelivery(proposalId: string): Promise<void>` — `delivery_confirmed_at = now()` 설정(스캔 게이트 통과 후, 의뢰자에게 알림 보내는 시점에 호출).
- `getDeliveryScanSummaryForViewer(requestId: string, viewerSellerId: string): Promise<{ proposal: ToolProposal; listing: Listing; findings: PublicFindingGroup[] } | null>` — 먼저 `tool_requests`에서 `requester_seller_id`를 조회하고, `tool_proposals WHERE request_id=... AND status='selected' AND delivery_confirmed_at IS NOT NULL`인 제안을 찾은 뒤, **`viewerSellerId`가 그 요청의 `requester_seller_id`이거나 그 선택된 제안의 `seller_id`인 경우에만** 결과를 반환하고 그 외에는 `null`(다른 판매자·비로그인은 이 함수를 호출해도 아무 정보도 못 받음 — 페이지 쪽에서 조건부로 호출 자체를 막는 것과 별개로 함수 내부에서도 이중으로 막는다). 연결된 `listings`/`scan_reports` 조인 후 `groupFindingsForBuyer`(기존 `lib/findingCategories.ts`)로 판매자 전용 세부정보를 제외하고 반환(`getPublicScanSummary`와 동일 원칙, 단 `listings.published`가 아니라 위 역할 조건으로 접근 허용).
- `completeToolRequest(requestId: string, requesterSellerId: string): Promise<boolean>` — `UPDATE tool_requests SET status='completed' WHERE id=... AND requester_seller_id=... AND status='in_progress' RETURNING id`(더미 결제 확인 버튼용, 원자적 가드).
- `canDeliverProposal(requestId: string, proposalId: string, sellerId: string): Promise<boolean>` — `tool_proposals WHERE id=... AND request_id=... AND seller_id=... AND status='selected'`가 있는지.
- `hasConfirmedDeliveryForRequest(sellerId: string, requestId: string): Promise<boolean>` — Task 8(재등록 프리필 검증)에서 사용, `tool_proposals WHERE request_id=... AND seller_id=... AND delivered_listing_id IS NOT NULL` 존재 여부.

비공개 스레드:
- `canAccessProposalThread(proposalId: string, sellerId: string): Promise<boolean>` — `tool_proposals JOIN tool_requests`로 `proposal.seller_id = sellerId OR tool_requests.requester_seller_id = sellerId`.
- `listToolProposalMessages(proposalId: string): Promise<ToolProposalMessageWithAuthor[]>` — 호출부에서 반드시 `canAccessProposalThread` 먼저 확인(이 함수 자체는 접근 체크 안 함 — `listCommunityCommentsForPost`와 동일 책임 분리 스타일).
- `createToolProposalMessage(input: { proposalId, senderSellerId, content }): Promise<ToolProposalMessage>`

- [ ] **Step 1~4 위 함수들을 기존 community 섹션 스타일 그대로 구현** (Row 타입 + `rowToX` 컨버터 함수 패턴 유지)
- [ ] **Step 5: Typecheck** `npx tsc --noEmit`
- [ ] **Step 6: Commit**

---

### Task 3: 이미지 업로드 API + 의뢰 생성 API

**Files:**
- Create: `app/api/requests/route.ts` (POST: 의뢰 생성 + 이미지 업로드, GET 없음 — 목록은 서버 컴포넌트에서 `lib/data.ts` 직접 호출)
- Create: `app/api/requests/images/[imageId]/route.ts` (GET: 업로드된 의뢰 사진을 인증 없이 스트리밍하는 공개 프록시 — Blob 스토어가 private 전용이라 필요, 설계 결정 5 갱신 내용 참고)
- Modify: `lib/data.ts` (`getToolRequestImageById(id: string): Promise<ToolRequestImage | null>` 추가 — Task 2가 끝난 뒤 이 Task 진행 중 필요성이 드러난 아주 작은 추가 함수, 기존 `getToolRequestImages`류 함수들과 동일한 단순 조회 패턴)

**Interfaces:**
- Consumes: `getCurrentSellerId`, `createToolRequest`, `addToolRequestImages`, `getToolRequestImageById`(Task 2 + 이 Task에서 추가), `@vercel/blob`의 `put`/`get`, `file-type`의 `fileTypeFromBuffer`, `sharp`.
- Produces: `POST /api/requests` — `multipart/form-data`(`title`, `description`, `budgetAmount`(선택), `budgetNegotiable`("on"/없음), `desiredDeadline`(선택), `requiredEnvironment`(선택), `referenceVideoUrl`(선택), `images`(파일, 1개 이상 반복 필드)) → `{ id: string }`. `GET /api/requests/images/[imageId]` — 로그인 여부와 무관하게 누구나 호출 가능(내용이 공개 정보이므로 소유권/인증 체크 없음), `tool_request_images`에 없는 id면 404, 있으면 이미지 바이트 스트리밍.

- [ ] **Step 1: 검증 상수/헬퍼**

```ts
const MAX_IMAGE_SIZE_BYTES = 2 * 1024 * 1024; // 프로필 사진과 동일 한도
const MAX_IMAGES = 5;
const ALLOWED_MIME_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);
const MAX_DIMENSION_PX = 1600; // 아바타처럼 정사각형 크롭이 아니라 최대 변 길이만 제한, 비율 유지
```
참고 영상 링크는 대략적인 URL 형태만 검증(`new URL(value)`가 던지지 않고 `protocol`이 `http:`/`https:`인지만 확인, 특정 플랫폼 화이트리스트 없음).

- [ ] **Step 2: `POST` 핸들러**
  1. `getCurrentSellerId()` 없으면 401.
  2. `request.formData()`로 텍스트 필드 파싱/트림, `title`/`description` 필수(길이 하한은 community 글쓰기와 동일한 관례로 제목 2자, 내용 5자 이상), `budgetAmount`는 있으면 `Number()`가 유한하고 0 이상인지, `desiredDeadline`/`requiredEnvironment`는 선택.
  3. `referenceVideoUrl` 있으면 위 URL 형식 검증, 실패 시 400.
  4. `formData.getAll("images")`로 파일 목록 획득. 0개면 400("사진을 최소 1장 첨부해주세요."), `MAX_IMAGES` 초과면 400.
  5. 각 파일에 대해 `app/api/profile/upload-image/route.ts`와 동일한 순서로 검증(SVG 거부 → 크기 → magic byte) 후 `sharp(...).resize(MAX_DIMENSION_PX, MAX_DIMENSION_PX, { fit: "inside", withoutEnlargement: true }).webp({ quality: 85 }).toBuffer()`, 하나라도 실패하면 전체 요청을 400으로 거부(아직 아무것도 DB/Blob에 쓰지 않은 시점이라 롤백 불필요).
  6. `createToolRequest(...)`로 행 생성 → 각 처리된 이미지를 `put(\`request-images/${request.id}-${i}-${randomUUID()}.webp\`, buffer, { access: "private", contentType: "image/webp" })`로 업로드(이 환경의 Blob 스토어가 private 전용 — `access:"public"`은 API 레벨에서 거부됨, 설계 결정 5 갱신 내용 참고) → 반환된 `url`들을 `addToolRequestImages(request.id, urls)`로 저장.
  7. `201` + `{ id: request.id }`.

- [ ] **Step 2-b: `GET /api/requests/images/[imageId]/route.ts`** — `app/api/profile/image/[sellerId]/route.ts`를 템플릿으로 삼되 **로그인 체크를 넣지 않는다**(공개 정보). `getToolRequestImageById(imageId)`로 행을 찾아 없으면 404, 있으면 `get(image.imageUrl, { access: "private" })`로 읽어 스트리밍. `Cache-Control`은 `public, max-age=31536000, immutable`(프로필 사진의 `private, no-store`와 다름 — 매 업로드가 새 랜덤 파일명이라 무효화 불필요).
- [ ] **Step 2-c: `lib/data.ts`에 `getToolRequestImageById` 추가** — 다른 단순 단건 조회 함수(`getToolProposalById` 등)와 동일한 패턴.
- [ ] **Step 3: Typecheck**
- [ ] **Step 4: 수동 검증** — dev 서버 기동 후 `curl -F`로: 이미지 0장(400), SVG 업로드(400), 정상 2장 업로드(응답은 `{ id: request.id }`만 옴). 생성된 `tool_request_images` 행들의 `id`를 확인(임시 조회 스크립트/라우트 사용 가능, 검증 후 삭제)한 뒤 `/api/requests/images/{그 id}`를 인증 쿠키 없이(`curl -s -o /dev/null -w "%{http_code}"`) 요청해 200이 오고 실제 이미지 바이트가 오는지 확인. 존재하지 않는 imageId로 요청 시 404도 확인.
- [ ] **Step 5: Commit**

---

### Task 4: 의뢰 게시판 목록/작성 화면

**Files:**
- Create: `app/requests/page.tsx`, `app/requests/new/page.tsx`, `app/requests/new/NewRequestForm.tsx`

**Interfaces:**
- Consumes: `listToolRequests`(Task 2), `POST /api/requests`(Task 3).

- [ ] **Step 1: `app/requests/page.tsx`** — `app/community/page.tsx` 구조 참고(카테고리 필터는 없으므로 페이지네이션만), 타이틀 "자동화 툴 의뢰", 우측 상단 버튼 "의뢰 등록하기"(→ `/requests/new`), 목록 각 항목에 "의뢰" 뱃지(community의 category pill과 같은 스타일) + 제목 + 작성자 닉네임 + 작성일 + (선택) 상태 표시("모집중"/"진행중"/"완료" — `status` 매핑) + 첫 번째 첨부 이미지 썸네일.
- [ ] **Step 2: `app/requests/new/page.tsx`** — `app/community/new/page.tsx`처럼 로그인 가드 후 `<NewRequestForm />` 렌더.
- [ ] **Step 3: `NewRequestForm.tsx`** ("use client", `app/community/new/NewPostForm.tsx` 패턴) — 필드: 제목, 기능 설명(textarea), 예산 숫자 입력 + "협의 가능" 체크박스(체크 시 숫자 입력 비활성화 아님 — 둘 다 채울 수 있음, 스펙 그대로), 희망 완료 시점(텍스트), 필요한 프로그램/환경(텍스트, 선택), 참고 영상 링크(텍스트, 선택), 사진 첨부(`<input type="file" multiple accept="image/jpeg,image/png,image/webp">`, 최소 1장 클라이언트 측 안내 + 서버가 최종 검증). 폼 하단에 고지 문구: "완성물은 제작자가 원하면 마켓에도 별도로 재판매할 수 있으며 저작권은 제작자에게 있습니다." 제출은 `fetch("/api/requests", { method: "POST", body: formData })`(FormData라 `Content-Type` 헤더 직접 지정 안 함), 성공 시 `router.push(\`/requests/${result.id}\`)`.
- [ ] **Step 4: Typecheck**
- [ ] **Step 5: 수동 검증** — 로그인 후 `/requests/new`에서 실제 폼 제출, `/requests` 목록에 반영되는지, 사진 미첨부 시 에러 뜨는지.
- [ ] **Step 6: Commit**

---

### Task 5: 의뢰 상세 + 제안 작성/선택

**Files:**
- Create: `app/requests/[requestId]/page.tsx`, `app/api/requests/[requestId]/proposals/route.ts`, `app/api/requests/[requestId]/proposals/[proposalId]/select/route.ts`, `app/requests/[requestId]/ProposalForm.tsx`, `app/requests/[requestId]/SelectProposalButton.tsx`

**Interfaces:**
- Consumes: `getToolRequestById`, `listToolRequestImages`, `listToolProposalsForRequest`, `createToolProposal`, `selectToolProposal`(Task 2).

- [ ] **Step 1: `POST /api/requests/[requestId]/proposals`** — `getCurrentSellerId` 401 가드, `getToolRequestById`로 존재/`status==='open'` 확인(아니면 400 "마감된 의뢰입니다"), 본인 의뢰에는 제안 불가(선택 사항이지만 의뢰자=판매자 셀프거래 방지로 최소 추가 — `request.requesterSellerId === sellerId`면 400), `price`(정수>0)/`duration`(비어있지 않음)/`description`(5자 이상) 검증 후 `createToolProposal`, `201` + `{ id }`.
- [ ] **Step 2: `POST /api/requests/[requestId]/proposals/[proposalId]/select`** — 401 가드, `getToolRequestById`로 `request.requesterSellerId === sellerId` 확인(아니면 403), `selectToolProposal` 호출 결과 false면 409("이미 선택되었거나 처리할 수 없는 상태입니다"), true면 `200`.
- [ ] **Step 3: `app/requests/[requestId]/page.tsx`** — `getToolRequestById`(없으면 `notFound()`) + `listToolRequestImages` + `listToolProposalsForRequest` + `getCurrentSellerId` 병렬 조회. 렌더: "의뢰" 뱃지 + 제목 + 상태 + 작성자 + 예산(협의가능이면 "협의 가능" 병기)/희망시점/필요환경 + 첨부 사진 그리드 + 참고 영상 링크(있으면 `<a target="_blank">`) + 제안 목록(각 제안: 판매자 닉네임/가격/기간/설명, `status==='selected'`면 강조 표시). `request.requesterSellerId === sellerId`이고 `request.status==='open'`이면 각 제안 옆에 `<SelectProposalButton>`. `sellerId`가 있고 `request.requesterSellerId !== sellerId`이고 `request.status==='open'`이면 하단에 `<ProposalForm requestId={...} />`. (비공개 스레드 UI는 이 Task에서 만들지 않는다 — Task 6이 전담해서 `ProposalThread.tsx` 생성과 이 페이지로의 삽입을 모두 담당한다.) `request.status==='in_progress'`이고 로그인한 판매자가 선택된 제안의 주인이면 "완성본 제출하기" 링크(→ Task 7의 `/requests/[requestId]/deliver`). `request.status==='in_progress'`이고 `sellerId`가 `request.requesterSellerId`이거나 선택된 제안의 `sellerId`이면(둘 중 하나) Task 7의 스캔 요약 블록을 삽입 — 단 그 안의 "확인 및 결제(더미) 완료하기" 버튼은 `sellerId===request.requesterSellerId`일 때만 렌더링(자세한 접근 규칙은 계획 서두의 설계 결정 2 참고).
- [ ] **Step 4: `ProposalForm.tsx`/`SelectProposalButton.tsx`** — `app/community/[postId]/CommentForm.tsx`와 동일한 fetch+`router.refresh()` 패턴(제출 중 상태, 에러 메시지, 성공 시 폼 초기화 또는 새로고침).
- [ ] **Step 5: Typecheck**
- [ ] **Step 6: 수동 검증** — 계정 A로 의뢰 생성, 계정 B로 로그인해 제안 2개 작성, A로 로그인해 하나 선택 → 상태가 "진행중"으로 바뀌고 나머지 제안엔 더 이상 선택 버튼이 안 뜨는지, B가 아닌 계정 C는 제안을 못 다는지(마감 후).
- [ ] **Step 7: Commit**

---

### Task 6: 제안별 비공개 스레드

**Files:**
- Create: `app/api/requests/proposals/[proposalId]/messages/route.ts`, `app/requests/[requestId]/ProposalThread.tsx`

**Interfaces:**
- Consumes: `canAccessProposalThread`, `listToolProposalMessages`, `createToolProposalMessage`(Task 2).

- [ ] **Step 1: `GET/POST /api/requests/proposals/[proposalId]/messages`** — 두 메서드 모두 첫 줄에서 `getCurrentSellerId` 401 가드 후 `canAccessProposalThread(proposalId, sellerId)` false면 **403**(다른 판매자의 제안 스레드는 존재 자체를 알 수 없어야 하므로 404가 아니라 403으로 통일해도 무방하나, 이 코드베이스는 소유권 실패 시 대체로 404/403을 혼용하지 않고 각 라우트 관례를 따름 — community report 라우트처럼 404 스타일을 따르고 싶다면 그렇게 해도 되나 접근 자체가 거부라는 의미가 더 정확하므로 403 권장). GET은 `listToolProposalMessages` 반환, POST는 `content` 검증(1~1000자) 후 `createToolProposalMessage` → `201`.
- [ ] **Step 2: `ProposalThread.tsx`** ("use client", `CommentForm.tsx` 패턴 + 최초 메시지 목록은 서버에서 props로 내려받고 새 메시지만 POST 후 `router.refresh()`) — props: `proposalId`, `initialMessages: ToolProposalMessageWithAuthor[]`. UI: 메시지 리스트(발신자 닉네임 + 시각 + 내용) + textarea + "보내기" 버튼.
- [ ] **Step 3: `app/requests/[requestId]/page.tsx`에 `<ProposalThread>` 삽입** — Task 5는 이 부분을 만들지 않았으므로(의도적으로 비워둠) 이 Task에서 처음 추가한다. 선택된 제안이 있으면(그 제안의 `status==='selected'`), `listToolProposalMessages` + `canAccessProposalThread` 결과에 따라 `request.requesterSellerId===sellerId || proposal.sellerId===sellerId`인 경우에만 그 제안 아래 삽입.
- [ ] **Step 4: Typecheck**
- [ ] **Step 5: 수동 검증** — 선택된 제안의 의뢰자/판매자 두 계정으로 메시지 주고받기 확인, 제3자(다른 판매자) 계정으로 같은 proposalId의 messages GET 시도 시 403 확인.
- [ ] **Step 6: Commit**

---

### Task 7: 완성본 제출 → 스캔 연동 → 완료 알림 → 더미 결제

**Files:**
- Modify: `app/actions.ts`(`collectFilesForSource`/`parseSourceType` export), `lib/email.ts`
- Create: `app/requestActions.ts`, `app/requests/[requestId]/deliver/page.tsx`, `app/requests/[requestId]/deliver/review/page.tsx`, `app/requests/[requestId]/ConfirmDeliveryButton.tsx`

**Interfaces:**
- Consumes: `runScan`(`lib/scanEngine`), `RULE_ENGINE_VERSION`(`lib/detector`), `saveScanReport`/`createDraftListing`/`getScanReportForOwner`(`lib/data`, 기존 함수 그대로), `canDeliverProposal`/`markProposalDelivered`/`confirmProposalDelivery`/`completeToolRequest`/`getDeliveryScanSummaryForViewer`(Task 2), `SourceTypeFields`(`app/listings/new/SourceTypeFields.tsx`, 기존 그대로 재사용).
- Produces: `sendRequestDeliveryReadyEmail(to, requestTitle, requestUrl)`(`lib/email.ts`, 기존 3개 함수와 동일한 가드/폴백 구조).

- [ ] **Step 1: `app/actions.ts`에서 `collectFilesForSource`/`parseSourceType` 앞의 `async function`/`function`을 `export async function`/`export function`으로만 바꾼다(로직 변경 없음, 순수 export 추가).**
- [ ] **Step 2: `lib/email.ts`에 함수 추가** — 기존 `sendVerificationEmail`/`sendPasswordResetEmail`/`sendFeedbackNotificationEmail`과 동일하게 `RESEND_API_KEY` 없으면 console.log 폴백, 실패해도 throw 안 함, `FROM_EMAIL` 상수 그대로 재사용.

```ts
export async function sendRequestDeliveryReadyEmail(
  to: string, requestTitle: string, requestUrl: string
): Promise<void> { /* 위 3개 함수와 동일 패턴, 제목: "[툴허브] 의뢰하신 자동화 툴이 완성되었습니다" */ }
```

- [ ] **Step 3: `app/requestActions.ts`** (새 파일, `"use server"`, `app/authActions.ts`와 나란한 최상위 액션 파일 — 기존 `app/actions.ts`는 건드리지 않음)
  - `submitDeliveryAction(formData)`: `getCurrentSellerId` 없으면 로그인 페이지로 redirect. `requestId = formData.get("requestId")`, `proposalId = formData.get("proposalId")`(둘 다 hidden input으로 넘어옴, `rescanListingAction`의 `formData.get("listingId")`와 동일한 패턴)로 `canDeliverProposal(requestId, proposalId, sellerId)` 확인(아니면 에러). 통과하면 `getToolRequestById(requestId)`/`getToolProposalById(proposalId)`로 제목/설명/가격을 조회(아래 `createDraftListing` 호출에 필요). `collectFilesForSource`/`parseSourceType`(Step 1에서 export)로 파일 수집 → `createDraftListing({ title: request.title, description: request.description, price: selectedProposal.price, category: "기타", codeUrl, sourceType, sellerId, sourceRequestId: requestId })` → `runScan`(delivery 페이지는 소스코드 입력 필드만 받고 제목/가격/카테고리를 별도로 물어보지 않으므로, 원 의뢰의 제목/설명과 선택된 제안의 가격을 그대로 채운다 — 이 리스팅은 `published=false`로 계속 남아 공개 마켓에 카테고리로 노출될 일이 없으므로 `category`는 고정값 `"기타"`로 충분하다) → `saveScanReport` → `markProposalDelivered(proposalId, listing.id)`. `hasUnresolvedFindings` 없으면 곧바로 Step 4의 "게이트 통과" 처리 후 `redirect(/requests/${requestId})`, 있으면 `redirect(/requests/${requestId}/deliver/review)`.
  - `deliverPublishAnywayAction(formData)` / `deliverRescanAction(formData)`: `/listings/[id]/review`의 `publishAnywayAction`/`rescanListingAction`과 거의 동일하되, **`publishListing()`을 호출하지 않는다** — 대신 게이트 통과 처리(아래)만 하고 `redirect(/requests/${requestId})`. `deliverRescanAction`은 기존과 동일하게 `updateListingSource` + 재스캔, 여전히 findings 있으면 review에 머무름.
  - 공통 "게이트 통과" 처리(헬퍼로 뽑기): `confirmProposalDelivery(proposalId)` → `getToolRequestById`로 의뢰자 이메일 조회 → `sendRequestDeliveryReadyEmail(requesterEmail, request.title, \`${origin}/requests/${requestId}\`)`.
  - `confirmDeliveryAction(formData)`: `getCurrentSellerId` 가드 → `completeToolRequest(requestId, sellerId)`(false면 에러) → (더미 결제이므로 별도 PG 호출 없음, 상태만 `completed`) → `redirect(/requests/${requestId}?completed=1)`.
- [ ] **Step 4: `app/requests/[requestId]/deliver/page.tsx`** — 로그인 가드 + `canDeliverProposal` 확인(아니면 접근 불가 안내), `app/listings/new/page.tsx`처럼 `<SourceTypeFields />` 재사용한 폼, `action={submitDeliveryAction}`, hidden input `requestId`/`proposalId`.
- [ ] **Step 5: `app/requests/[requestId]/deliver/review/page.tsx`** — `app/listings/[id]/review/page.tsx`를 거의 그대로 복제하되 액션만 `deliverPublishAnywayAction`/`deliverRescanAction`으로, 조회는 `getScanReportForOwner`(기존 함수 그대로, listing 소유자=판매자 본인이라 그대로 씀).
- [ ] **Step 6: `ConfirmDeliveryButton.tsx`** — props로 `summary`(`getDeliveryScanSummaryForViewer` 결과, null이면 아직 게이트 통과 전이라 컴포넌트 자체를 렌더링 안 함)와 `canConfirm: boolean`을 받는다. 스캔 요약(발견 항목 카테고리/심각도 등, `ScanSummaryCard` 재사용 가능하면 재사용)은 `summary`가 있으면 항상 보여주고, "확인 및 결제(더미) 완료하기" 버튼(`action={confirmDeliveryAction}`)은 `canConfirm`이 true일 때만 렌더링한다. Task 5의 상세 페이지에서: `summary = sellerId && (sellerId===request.requesterSellerId || sellerId===selectedProposal?.sellerId) ? await getDeliveryScanSummaryForViewer(request.id, sellerId) : null`로 조회한 뒤(role이 아니면 함수 자체를 호출하지 않음 — 설계 결정 2), `<ConfirmDeliveryButton summary={summary} canConfirm={sellerId === request.requesterSellerId} />`로 삽입.
- [ ] **Step 7: Typecheck**
- [ ] **Step 8: 수동 검증** — 정상 코드 제출(findings 없음) → 즉시 의뢰자 이메일 도착(dev면 콘솔 로그, `RESEND_API_KEY` 있으면 실제 발송) → 의뢰자 화면에 스캔 요약 노출 → 확인 버튼 클릭 → 상태 "완료". 문제 있는 코드 제출 → review 페이지로 이동 → "그대로 게시" 클릭 → 동일하게 완료 플로우 진입. **각 케이스마다 공개 마켓 홈(`/`)에 이 매물이 노출되지 않는지(published=false 유지) 반드시 확인.** **스캔 요약 블록 접근 권한도 함께 확인**: 선택된 판매자 본인 로그인 시 요약은 보이되 확인/결제 버튼은 안 보이는지, 그 의뢰에 제안을 넣었지만 선택되지 않은 다른 판매자 계정과 비로그인 방문자로 같은 URL에 접속했을 때 스캔 요약 블록 자체가 전혀 안 보이는지.
- [ ] **Step 9: Commit**

---

### Task 8: 마켓 재등록(프리필) 연결

**Files:**
- Modify: `app/actions.ts`(`createListingAction`), `app/listings/new/page.tsx`
- Create 또는 Modify: `app/requests/[requestId]/RegisterToMarketLink.tsx`(선택 — 단순 `<Link>`면 파일 없이 인라인으로 충분)

**Interfaces:**
- Consumes: `hasConfirmedDeliveryForRequest`(Task 2).

- [ ] **Step 1: `app/listings/new/page.tsx`가 `searchParams`(`PageProps<"/listings/new">`)를 받도록 하고, `sourceRequestId`/`title`/`description` 쿼리 파라미터가 있으면 각 input의 `defaultValue`로 채우고, 폼에 `<input type="hidden" name="sourceRequestId" value={sourceRequestId ?? ""} />` 추가.**
- [ ] **Step 2: `createListingAction`에서 `sourceRequestId = formData.get("sourceRequestId")`를 읽되, 비어있지 않으면 `hasConfirmedDeliveryForRequest(sellerId, sourceRequestId)`로 "이 판매자가 실제로 그 의뢰를 납품 완료했는지" 검증 — 아니면 `null`로 무시(클라이언트 값을 그대로 믿지 않음, IDOR 방지). 검증 통과 시에만 `createDraftListing`에 `sourceRequestId` 전달.**
- [ ] **Step 3: Task 5 상세 페이지에 `request.status==='completed'`이고 로그인 판매자가 그 제안의 주인이면 "매물로도 등록하기" 링크(`/listings/new?sourceRequestId=${id}&title=${encodeURIComponent(...)}&description=${encodeURIComponent(...)}`) 추가.**
- [ ] **Step 4: Typecheck**
- [ ] **Step 5: 수동 검증** — 완료된 의뢰에서 링크 클릭 → 프리필 확인 → 등록 → 이번엔 정상적으로 스캔 후 공개 마켓에도 노출되는지(이건 `published=true`가 정상 목표) 확인. 다른 사람이 URL의 `sourceRequestId`를 임의로 바꿔 넣어도 연결이 안 되는지(내부 로그로 `null` 처리 확인).
- [ ] **Step 6: Commit**

---

### Task 9: 헤더 내비게이션 + SCOPE.md + 커뮤니티 예고 공지

**Files:**
- Modify: `app/_components/SiteHeader.tsx`, `SCOPE.md`, `lib/db.ts`(`SEED_COMMUNITY_POSTS`)

- [ ] **Step 1: `SiteHeader.tsx`** — 좌측 그룹을 "홈"(`/`) / "자동화 툴 의뢰"(`/requests`) / "커뮤니티"(`/community`) 3개 동일 스타일 링크로 교체. 우측의 "매물 등록하기" `<Link>` 제거(`AuthStatus`는 그대로 유지). 홈 히어로의 "내 툴 등록하고 스캔받기" CTA(`app/page.tsx`, `registerHref` 로직)는 이미 존재하므로 손대지 않는다.
- [ ] **Step 2: `SCOPE.md` 갱신** — "등록→스캔→결과확인" 문구를 "이미 배포 완료된 이전 스프린트 범위"로 표시하고, 이번 스프린트 목표를 "자동화 툴 의뢰(맞춤제작 요청) 게시판" 및 이 문서(Task 1~9) 범위로 교체. 기존 "이번 스프린트 제외 범위"에서 "마켓 리스팅"은 삭제(이미 배포됨), 이번 계획의 "제약" 섹션(실시간 채팅/견적 협상 UI/PG 실연동/동영상 업로드 등)을 새 제외 범위로 명시.
- [ ] **Step 3: `SEED_COMMUNITY_POSTS`의 `id: "cp-tool-request-preview"` 항목** — 실제 오픈된 방식(제안 비교 후 의뢰자가 선택)에 맞게 본문을 갱신하거나, "자동화 툴 의뢰" 메뉴로 안내하는 공지로 대체한다(둘 중 하나 선택해 구현 — 완전히 지우기보다는 "열렸습니다 + 이용 방법 요약 + `/requests` 링크 안내"로 갱신하는 쪽을 권장, 기존 seed idempotency(`ON CONFLICT (id) DO NOTHING`)상 이미 DB에 들어간 문서라면 이 코드 변경만으로는 기존 프로덕션 행이 갱신되지 않는다는 점을 감안 — 필요하면 `ON CONFLICT (id) DO UPDATE SET content = EXCLUDED.content`로 시드 upsert 방식을 이 한 건에 한해 바꿀지 여부를 실행 시점에 판단).
- [ ] **Step 4: Typecheck**
- [ ] **Step 5: 수동 검증** — 헤더가 모든 페이지에서 3개 링크로 보이는지, "매물 등록하기" 버튼이 사라졌는지, 홈 CTA는 그대로인지.
- [ ] **Step 6: Commit**

---

### Task 10: 전체 검증 + 정리

- [ ] **Step 1:** `npx tsc --noEmit`, `npx vitest run` 전체 통과 확인.
- [ ] **Step 2:** dev 서버 + 실제(또는 임시) DB로 E2E: 의뢰 등록(사진 포함) → 제안 2건 → 선택 → 비공개 스레드 대화 → 납품 제출(정상 케이스 1회 + findings 있는 케이스 1회) → 이메일 알림 확인 → 의뢰자 확인/더미결제 → 완료 후 마켓 재등록까지 전 구간.
- [ ] **Step 3:** 검증에 쓴 임시 계정/의뢰/제안/이미지 Blob/리스팅을 전부 정리(이전 세션들처럼 임시 API 라우트로 조회 후 삭제, 삭제 후 라우트 자체도 제거).
- [ ] **Step 4:** 기존 매물 마켓 홈/상세, 커뮤니티 목록/상세/댓글/신고, 회원가입/이메일 인증 흐름이 이번 변경으로 깨지지 않았는지 회귀 확인(헤더가 바뀌었으므로 특히 네비게이션 동작).
- [ ] **Step 5:** 최종 커밋 + (사용자 승인 시) push.
