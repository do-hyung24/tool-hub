# Privacy Policy & Account Deletion Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship a privacy policy page, a required consent checkbox on signup, a self-service account-deletion flow with a 14-day recovery grace period, and a daily cron job that hard-deletes accounts (and their listings) once that grace period has elapsed.

**Architecture:** This is a Next.js 16 App Router project using NextAuth v5 (JWT sessions, Credentials provider) and the Neon serverless Postgres driver (`@neondatabase/serverless`, raw tagged-template SQL, no ORM). Schema changes are idempotent `ALTER TABLE ... ADD COLUMN IF NOT EXISTS` statements inside `lib/db.ts`'s `initialize()` — there is no separate migrations directory. All data access goes through `lib/data.ts`. Auth gating lives in `lib/auth.ts`'s `authorize()` callback. The plan adds one nullable column (`sellers.deletion_requested_at`), a soft-delete write path, a read-path filter that hides soft-deleted sellers' listings, a login-time hard block for soft-deleted accounts, and a Vercel Cron-triggered API route that performs the actual hard delete after 14 days.

**Tech Stack:** Next.js 16 (App Router, Server Actions), NextAuth v5 beta (Credentials provider, JWT sessions), `@neondatabase/serverless` (raw SQL), `resend` (email), `bcryptjs`, `vitest`, Vercel Cron (`vercel.json`).

**Spec:** The plan implements the user's Korean spec delivered in this conversation (privacy policy page with verbatim legal text, signup consent checkbox, `sellers.deletion_requested_at` column, self-service deletion with immediate logout + immediate listing hiding, login blocking for deletion-pending accounts, and a `CRON_SECRET`-guarded daily purge route wired into `vercel.json`). There is no separate spec file — this plan document is the spec's only durable copy; the exact privacy-policy Korean text is reproduced verbatim inside Task 2.

## Global Constraints

- Do not modify existing login, scan, or listing-registration business logic beyond what each task below explicitly touches. `signupAction`, `authorize()`, `getListings()`/`getListingById()`, and the listing detail page all get *additive* changes only.
- The privacy policy text in Task 2 must be reproduced **word-for-word** from the spec — no rewording, no added/removed sentences, no changed numbers or dates. Only HTML structuring (headings, `<ul>`/`<li>`, paragraph breaks) may be added around the verbatim text.
- New date/timestamp columns must be stored as `TEXT` holding an ISO-8601 string (`new Date().toISOString()`), matching every existing date column in this schema (`listings.created_at`, `email_verification_tokens.expires_at`, `password_reset_tokens.expires_at`/`used_at`) — **not** a native `TIMESTAMP` column, which would be the only one of its kind in this schema and would need different comparison code paths.
- Grace period is exactly `14 * 24 * 60 * 60 * 1000` ms. Support/admin contact address is `dohyung.p03@gmail.com` — define it once as `SUPPORT_EMAIL` (Task 1) and reuse it everywhere instead of re-typing the literal.
- Schema changes follow the existing pattern in `lib/db.ts`: `CREATE TABLE IF NOT EXISTS` / `ALTER TABLE ... ADD COLUMN IF NOT EXISTS` inside `initialize()`. Do not create a separate migrations directory.
- No transactions are used anywhere in this codebase's DB layer (the Neon HTTP driver query style here is sequential `await sql\`...\`` calls) — new multi-statement writes (the purge cascade) follow that same sequential-no-transaction pattern.
- Automated tests in this repo only cover pure, DB-free logic (`lib/detector.test.ts`, `lib/findingCategories.test.ts`, etc. — see `vitest.config.ts`'s `include: ["lib/**/*.test.ts"]`). Do not attempt to unit-test anything that calls `getSql()`/hits Postgres or NextAuth's `authorize()` — verify those paths manually against the real dev DB, per Task 13.

---

### Task 1: Support-email constant

**Files:**
- Create: `lib/constants.ts`

**Interfaces:**
- Produces: `SUPPORT_EMAIL: string` — the literal `"dohyung.p03@gmail.com"`, imported by Task 2 (privacy page), Task 7 (`lib/auth.ts` error message... actually consumed via Task 8's `authActions.ts`), and Task 11 (`app/account/delete/page.tsx`).

- [ ] **Step 1: Create the constant**

```ts
// lib/constants.ts
export const SUPPORT_EMAIL = "dohyung.p03@gmail.com";
```

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit`
Expected: no new errors (nothing imports it yet).

- [ ] **Step 3: Commit**

```bash
git add lib/constants.ts
git commit -m "$(cat <<'EOF'
add SUPPORT_EMAIL constant for privacy/deletion contact address

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01LDgUbxopUWxwaVM3iqL6wa
EOF
)"
```

---

### Task 2: Privacy policy page

**Files:**
- Create: `app/privacy/page.tsx`

**Interfaces:**
- Consumes: `SUPPORT_EMAIL` from `@/lib/constants` (Task 1).
- Produces: route `/privacy`, linked from Task 9 (signup checkbox).

- [ ] **Step 1: Create the page with the verbatim policy text**

```tsx
// app/privacy/page.tsx
import { SUPPORT_EMAIL } from "@/lib/constants";

export default function PrivacyPage() {
  return (
    <main className="mx-auto w-full max-w-3xl flex-1 px-6 py-10">
      <h1 className="text-2xl font-bold">개인정보처리방침</h1>
      <p className="mt-4 text-sm leading-relaxed text-zinc-700 dark:text-zinc-300">
        &quot;툴허브&quot;(이하 &quot;회사&quot;)는 이용자의 개인정보를 중요시하며, 「개인정보 보호법」 등 관련
        법령을 준수하고 있습니다.
      </p>

      <div className="mt-10 flex flex-col gap-10">
        <section>
          <h2 className="text-lg font-semibold">1. 수집하는 개인정보 항목</h2>
          <ul className="mt-3 list-disc space-y-2 pl-5 text-sm leading-relaxed text-zinc-700 dark:text-zinc-300">
            <li>필수 항목: 이메일 주소, 비밀번호(암호화 저장)</li>
            <li>
              매물 등록 시: 판매자가 직접 입력하는 연락처 정보(이메일, 카카오톡 ID, 텔레그램 등 연락
              수단) 해당 정보는 매물 상세 페이지를 통해 구매 희망자에게 공개됩니다.
            </li>
            <li>자동 수집 항목: 접속 IP 정보, 쿠키(로그인 세션 유지 목적), 서비스 이용 기록</li>
          </ul>
        </section>

        <section>
          <h2 className="text-lg font-semibold">2. 개인정보의 수집 및 이용 목적</h2>
          <ul className="mt-3 list-disc space-y-2 pl-5 text-sm leading-relaxed text-zinc-700 dark:text-zinc-300">
            <li>회원 식별, 로그인 처리 및 이메일 인증을 통한 실사용자 확인</li>
            <li>매물 등록자와 구매 희망자 간의 원활한 연락 및 거래 연결</li>
            <li>비밀번호 재설정 등 계정 관리 및 고객 문의 대응</li>
            <li>서비스 부정 이용 방지 및 비인가 사용 방지</li>
          </ul>
        </section>

        <section>
          <h2 className="text-lg font-semibold">3. 개인정보의 보유 및 이용 기간</h2>
          <ul className="mt-3 list-disc space-y-2 pl-5 text-sm leading-relaxed text-zinc-700 dark:text-zinc-300">
            <li>
              이용자의 개인정보는 원칙적으로 회원 탈퇴 요청 시 14일간 보관 후 지체 없이 영구
              파기합니다.
              <ul className="mt-2 list-[circle] space-y-1 pl-5">
                <li>
                  보관 목적: 탈퇴 후 재가입을 통한 부정 이용 방지, 거래 관련 분쟁 해결 및 이용자의
                  실수로 인한 탈퇴 복구 요청 대응
                </li>
              </ul>
            </li>
            <li>
              단, 관계 법령의 규정에 의하여 보존할 필요가 있는 경우 해당 법령에서 정한 일정 기간 동안
              별도 DB로 분리하여 보관합니다.
              <ul className="mt-2 list-[circle] space-y-1 pl-5">
                <li>
                  전자상거래 등에서의 소비자보호에 관한 법률:
                  <ul className="mt-1 list-square space-y-1 pl-5">
                    <li>표시/광고에 관한 기록: 6개월</li>
                    <li>계약 또는 청약철회, 대금결제, 재화 등의 공급에 관한 기록: 5년</li>
                    <li>소비자 불만 또는 분쟁처리에 관한 기록: 3년</li>
                  </ul>
                </li>
              </ul>
            </li>
          </ul>
        </section>

        <section>
          <h2 className="text-lg font-semibold">4. 개인정보의 제3자 제공 및 공개</h2>
          <ul className="mt-3 list-disc space-y-2 pl-5 text-sm leading-relaxed text-zinc-700 dark:text-zinc-300">
            <li>회사는 이용자의 동의 없이 개인정보를 외부에 제공하지 않습니다.</li>
            <li>
              다만, 판매자가 매물 등록 시 직접 입력한 연락처 정보는 구매 희망자와의 거래 연결을 위해
              매물 상세 페이지에 공개됩니다. 판매자는 매물 등록 시 해당 정보의 공개에 동의한 것으로
              간주합니다.
            </li>
          </ul>
        </section>

        <section>
          <h2 className="text-lg font-semibold">5. 개인정보 처리업무의 위탁 및 국외 이전</h2>
          <p className="mt-3 text-sm leading-relaxed text-zinc-700 dark:text-zinc-300">
            회사는 원활한 서비스 제공을 위해 아래와 같이 외부 전문업체에 개인정보 처리 업무를 위탁하고
            있으며, 서버 위치에 따라 국외로 이전될 수 있습니다.
          </p>
          <ul className="mt-3 list-disc space-y-2 pl-5 text-sm leading-relaxed text-zinc-700 dark:text-zinc-300">
            <li>Resend: 이메일 인증 및 시스템 알림 발송 (미국)</li>
            <li>Neon (PostgreSQL): 데이터베이스 호스팅 및 사용자 데이터 저장 (미국/해외 서버)</li>
            <li>Vercel: 웹 서비스 호스팅 및 배포 (미국/해외 CDN)</li>
          </ul>
        </section>

        <section>
          <h2 className="text-lg font-semibold">6. 이용자의 권리와 행사 방법</h2>
          <ul className="mt-3 list-disc space-y-2 pl-5 text-sm leading-relaxed text-zinc-700 dark:text-zinc-300">
            <li>
              이용자는 언제든지 등록되어 있는 자신의 개인정보를 열람하거나 수정할 수 있으며, 회원
              탈퇴를 통해 개인정보 삭제를 요청할 수 있습니다.
            </li>
            <li>문의 사항은 아래의 관리자 이메일로 연락 주시면 지체 없이 조치하겠습니다.</li>
          </ul>
        </section>

        <section>
          <h2 className="text-lg font-semibold">7. 개인정보의 파기 절차 및 방법</h2>
          <ul className="mt-3 list-disc space-y-2 pl-5 text-sm leading-relaxed text-zinc-700 dark:text-zinc-300">
            <li>
              파기 기한: 이용자의 개인정보는 탈퇴 후 14일의 유예 기간이 경과한 날로부터 5일 이내에
              영구 파기합니다.
            </li>
            <li>
              파기 방법: 전자적 파일 형태로 저장된 개인정보는 기록을 재생할 수 없는 기술적 방법을
              사용하여 영구 삭제합니다.
            </li>
          </ul>
        </section>

        <section>
          <h2 className="text-lg font-semibold">8. 개인정보 보호책임자</h2>
          <ul className="mt-3 list-disc space-y-2 pl-5 text-sm leading-relaxed text-zinc-700 dark:text-zinc-300">
            <li>담당자: 도형</li>
            <li>문의 이메일: {SUPPORT_EMAIL}</li>
          </ul>
        </section>

        <section>
          <h2 className="text-lg font-semibold">9. 고지의 의무</h2>
          <p className="mt-3 text-sm leading-relaxed text-zinc-700 dark:text-zinc-300">
            본 개인정보처리방침은 시행일로부터 적용되며, 법령 및 방침에 따른 변경내용의 추가, 삭제 및
            수정이 있는 경우에는 공지사항을 통해 변경 사항을 고지합니다.
          </p>
        </section>
      </div>

      <p className="mt-10 text-sm font-medium text-zinc-500 dark:text-zinc-400">
        시행일자: 2026년 9월 9일
      </p>
    </main>
  );
}
```

- [ ] **Step 2: Verify the route renders**

Run: `npm run dev` (in background/another terminal), then open `http://localhost:3000/privacy`.
Expected: all nine numbered sections render with the exact Korean text above, no console errors.

- [ ] **Step 3: Typecheck**

Run: `npx tsc --noEmit`
Expected: no new errors.

- [ ] **Step 4: Commit**

```bash
git add app/privacy/page.tsx
git commit -m "$(cat <<'EOF'
add /privacy page with the required privacy policy text

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01LDgUbxopUWxwaVM3iqL6wa
EOF
)"
```

---

### Task 3: `sellers.deletion_requested_at` schema column

**Files:**
- Modify: `lib/db.ts:160-164`

**Interfaces:**
- Produces: `sellers.deletion_requested_at` (`TEXT`, nullable, ISO-8601 string when set) — consumed by Task 4 (read-path filter), Task 5 (write path), Task 6 (purge), Task 7 (`authorize()`).

- [ ] **Step 1: Add the idempotent column migration**

In `lib/db.ts`, immediately after the existing three `ALTER TABLE sellers ADD COLUMN IF NOT EXISTS` lines (currently lines 162-164):

```ts
  await sql`ALTER TABLE sellers ADD COLUMN IF NOT EXISTS email TEXT`;
  await sql`ALTER TABLE sellers ADD COLUMN IF NOT EXISTS password_hash TEXT`;
  await sql`ALTER TABLE sellers ADD COLUMN IF NOT EXISTS email_verified BOOLEAN NOT NULL DEFAULT FALSE`;
  // 탈퇴 요청 시각(ISO 문자열). NULL이면 정상 계정, 값이 있으면 14일 유예 기간 중이며
  // 로그인이 차단되고 매물이 공개 목록에서 즉시 숨겨진다 (lib/auth.ts, lib/data.ts 참고).
  await sql`ALTER TABLE sellers ADD COLUMN IF NOT EXISTS deletion_requested_at TEXT`;
```

- [ ] **Step 2: Verify migration runs cleanly**

Run: `npm run dev`, then visit any page that touches the DB (e.g. `/`) to trigger `ensureInitialized()`.
Expected: no errors in the dev server console; the app loads normally.

- [ ] **Step 3: Confirm the column exists**

Run a one-off check against your dev DB, e.g. via `psql "$DATABASE_URL" -c "\d sellers"` (or the Neon SQL console), and confirm `deletion_requested_at | text |` appears.
Expected: column present, nullable, no default.

- [ ] **Step 4: Typecheck**

Run: `npx tsc --noEmit`
Expected: no new errors.

- [ ] **Step 5: Commit**

```bash
git add lib/db.ts
git commit -m "$(cat <<'EOF'
add sellers.deletion_requested_at column for soft-delete

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01LDgUbxopUWxwaVM3iqL6wa
EOF
)"
```

---

### Task 4: Hide deletion-pending sellers' listings from public reads

**Files:**
- Modify: `lib/data.ts:88-106` (`getListings`, `getListingById`)

**Interfaces:**
- Consumes: `sellers.deletion_requested_at` (Task 3).
- Produces: no signature change — `getListings(): Promise<Listing[]>` and `getListingById(id: string): Promise<Listing | null>` keep their existing types; callers (`app/page.tsx`, `app/listings/[id]/page.tsx`) need no changes.

- [ ] **Step 1: Join against `sellers` and exclude deletion-pending accounts**

Replace lines 88-106 of `lib/data.ts`:

```ts
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
```

(`getListingForOwner`, immediately below, is unchanged — the owner-scoped path is unreachable for a deletion-pending seller anyway, since Task 8's `requestAccountDeletionAction` signs them out immediately and Task 7 blocks them from logging back in.)

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit`
Expected: no new errors.

- [ ] **Step 3: Manual verification (deferred to Task 13)**

This task's behavior is exercised end-to-end in Task 13 Step 1 (request deletion → listing disappears from `/`). No isolated test here since it requires a live DB and a seeded listing.

- [ ] **Step 4: Commit**

```bash
git add lib/data.ts
git commit -m "$(cat <<'EOF'
exclude deletion-pending sellers' listings from public reads

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01LDgUbxopUWxwaVM3iqL6wa
EOF
)"
```

---

### Task 5: `requestAccountDeletion` write path

**Files:**
- Modify: `lib/data.ts` (add new function after `publishListing`, i.e. after the current last line, 495)

**Interfaces:**
- Consumes: `sellers.deletion_requested_at` (Task 3).
- Produces: `requestAccountDeletion(sellerId: string): Promise<void>` — consumed by Task 8's `requestAccountDeletionAction`.

- [ ] **Step 1: Add the function**

Append to the end of `lib/data.ts`:

```ts
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
```

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit`
Expected: no new errors.

- [ ] **Step 3: Commit**

```bash
git add lib/data.ts
git commit -m "$(cat <<'EOF'
add requestAccountDeletion data-layer function

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01LDgUbxopUWxwaVM3iqL6wa
EOF
)"
```

---

### Task 6: Purge-eligibility logic (TDD) + hard-delete cascade

**Files:**
- Create: `lib/data.test.ts`
- Modify: `lib/data.ts` (add after Task 5's `requestAccountDeletion`)

**Interfaces:**
- Produces:
  - `DELETION_GRACE_PERIOD_MS: number` (`14 * 24 * 60 * 60 * 1000`)
  - `isEligibleForPurge(deletionRequestedAt: string, now?: Date): boolean` — pure, DB-free, unit-tested here.
  - `purgeExpiredDeletedAccounts(): Promise<{ purgedCount: number }>` — consumed by Task 12's cron route.

- [ ] **Step 1: Write the failing test**

```ts
// lib/data.test.ts
import { describe, expect, it } from "vitest";
import { DELETION_GRACE_PERIOD_MS, isEligibleForPurge } from "./data";

describe("isEligibleForPurge", () => {
  it("is not eligible before the 14-day grace period elapses", () => {
    const now = new Date("2026-01-15T00:00:00.000Z");
    const requestedAt = new Date(now.getTime() - DELETION_GRACE_PERIOD_MS + 1000).toISOString();
    expect(isEligibleForPurge(requestedAt, now)).toBe(false);
  });

  it("is eligible exactly at the 14-day boundary", () => {
    const now = new Date("2026-01-15T00:00:00.000Z");
    const requestedAt = new Date(now.getTime() - DELETION_GRACE_PERIOD_MS).toISOString();
    expect(isEligibleForPurge(requestedAt, now)).toBe(true);
  });

  it("is eligible well past the grace period", () => {
    const now = new Date("2026-01-15T00:00:00.000Z");
    const requestedAt = new Date(now.getTime() - 20 * 24 * 60 * 60 * 1000).toISOString();
    expect(isEligibleForPurge(requestedAt, now)).toBe(true);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run lib/data.test.ts`
Expected: FAIL — `isEligibleForPurge` (and `DELETION_GRACE_PERIOD_MS`) are not exported from `./data` yet.

- [ ] **Step 3: Implement `isEligibleForPurge`, `DELETION_GRACE_PERIOD_MS`, and `purgeExpiredDeletedAccounts`**

Append to `lib/data.ts` (after Task 5's `requestAccountDeletion`):

```ts
export const DELETION_GRACE_PERIOD_MS = 14 * 24 * 60 * 60 * 1000; // 14일

// 순수 함수로 분리해 실제 DB 연결 없이도 경계값(정확히 14일 경과 등)을 테스트할 수 있게 한다.
export function isEligibleForPurge(deletionRequestedAt: string, now: Date = new Date()): boolean {
  return now.getTime() - new Date(deletionRequestedAt).getTime() >= DELETION_GRACE_PERIOD_MS;
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

  for (const target of targets) {
    await sql`
      DELETE FROM scan_reports
      WHERE listing_id IN (SELECT id FROM listings WHERE seller_id = ${target.id})
         OR author_id = ${target.id}
    `;
    await sql`DELETE FROM listings WHERE seller_id = ${target.id}`;
    await sql`DELETE FROM email_verification_tokens WHERE seller_id = ${target.id}`;
    await sql`DELETE FROM password_reset_tokens WHERE seller_id = ${target.id}`;
    await sql`DELETE FROM sellers WHERE id = ${target.id}`;
  }

  return { purgedCount: targets.length };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run lib/data.test.ts`
Expected: PASS (3/3).

- [ ] **Step 5: Typecheck**

Run: `npx tsc --noEmit`
Expected: no new errors.

- [ ] **Step 6: Commit**

```bash
git add lib/data.ts lib/data.test.ts
git commit -m "$(cat <<'EOF'
add purge-eligibility logic and hard-delete cascade for expired accounts

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01LDgUbxopUWxwaVM3iqL6wa
EOF
)"
```

---

### Task 7: Block login for deletion-pending accounts

**Files:**
- Modify: `lib/auth.ts`

**Interfaces:**
- Consumes: `sellers.deletion_requested_at` (Task 3).
- Produces: `export class AccountDeletionPendingError extends CredentialsSignin` — consumed by Task 8's `loginAction`.

- [ ] **Step 1: Import `CredentialsSignin` and add the custom error class**

In `lib/auth.ts`, change line 2:

```ts
import NextAuth, { type DefaultSession, CredentialsSignin } from "next-auth";
```

Then, replace the `SellerAuthRow` type (currently lines 29-34) with the version below, and add the new error class immediately after it:

```ts
type SellerAuthRow = {
  id: string;
  email: string | null;
  nickname: string;
  password_hash: string | null;
  deletion_requested_at: string | null;
};

// authorize()가 비밀번호까지 확인한 뒤 탈퇴 처리 중인 계정임을 발견하면 이 에러를 던진다.
// CredentialsSignin의 `code`는 next-auth가 그대로 보존해 호출부(app/authActions.ts의
// loginAction)까지 전달하므로, "비밀번호 틀림"과 구분되는 안내 문구를 보여줄 수 있다.
export class AccountDeletionPendingError extends CredentialsSignin {
  code = "account_deletion_pending";
}
```

- [ ] **Step 2: Select the new column and check it after password verification**

Replace the body of `authorize` (currently lines 48-74):

```ts
      async authorize(credentials) {
        const email =
          typeof credentials?.email === "string"
            ? credentials.email.trim().toLowerCase()
            : "";
        const password =
          typeof credentials?.password === "string" ? credentials.password : "";
        if (!email || !password) return null;

        await ensureInitialized();
        const sql = getSql();
        const rows = (await sql`
          SELECT id, email, nickname, password_hash, deletion_requested_at
          FROM sellers WHERE email = ${email}
        `) as SellerAuthRow[];
        const seller = rows[0];
        if (!seller || !seller.password_hash) return null;

        const valid = await verifyPassword(password, seller.password_hash);
        if (!valid) return null;

        // 비밀번호까지 확인한 뒤에만 탈퇴 여부를 확인한다 - 그래야 이 계정이 탈퇴
        // 처리 중이라는 사실이 비밀번호를 모르는 사람에게 새어나가지 않는다.
        if (seller.deletion_requested_at) {
          throw new AccountDeletionPendingError();
        }

        return {
          id: seller.id,
          email: seller.email,
          name: seller.nickname,
          nickname: seller.nickname,
        };
      },
```

- [ ] **Step 3: Typecheck**

Run: `npx tsc --noEmit`
Expected: no new errors.

- [ ] **Step 4: Manual verification (deferred to Task 13)**

This is exercised end-to-end in Task 13 Step 2.

- [ ] **Step 5: Commit**

```bash
git add lib/auth.ts
git commit -m "$(cat <<'EOF'
block login for accounts pending deletion

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01LDgUbxopUWxwaVM3iqL6wa
EOF
)"
```

---

### Task 8: Server actions — signup consent, deletion-pending login message, deletion request

**Files:**
- Modify: `app/authActions.ts`

**Interfaces:**
- Consumes: `AccountDeletionPendingError` from `@/lib/auth` (Task 7), `requestAccountDeletion` from `@/lib/data` (Task 5), `SUPPORT_EMAIL` from `@/lib/constants` (Task 1), `getCurrentSellerId` from `@/lib/session` (already imported).
- Produces: `requestAccountDeletionAction(): Promise<void>` — a bare server action (no `FormData`/prev-state args, matching `logoutAction`'s shape) — consumed by Task 11's confirmation page form.

- [ ] **Step 1: Update imports**

Replace lines 1-19 of `app/authActions.ts`:

```ts
"use server";

import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { AuthError } from "next-auth";
import { AccountDeletionPendingError, signIn, signOut } from "@/lib/auth";
import { getCurrentSellerId } from "@/lib/session";
import {
  createEmailVerificationToken,
  createPasswordResetToken,
  createSeller,
  getSellerByEmail,
  getSellerById,
  getSellerByNickname,
  requestAccountDeletion,
  resetPasswordWithToken,
  verifyEmailCode,
} from "@/lib/data";
import { hashPassword } from "@/lib/password";
import { sendPasswordResetEmail, sendVerificationEmail } from "@/lib/email";
import { SUPPORT_EMAIL } from "@/lib/constants";
```

- [ ] **Step 2: Validate the consent checkbox in `signupAction`**

In `signupAction`, add this check right after the existing nickname check (currently lines 72-74, `if (!nickname) { throw new Error("닉네임을 입력해주세요."); }`):

```ts
  if (!nickname) {
    throw new Error("닉네임을 입력해주세요.");
  }
  const agreedToPrivacy = formData.get("agreedToPrivacy") === "on";
  if (!agreedToPrivacy) {
    throw new Error("개인정보처리방침에 동의해야 가입할 수 있습니다.");
  }
```

- [ ] **Step 3: Distinguish the deletion-pending error in `loginAction`**

Replace the current `loginAction` body (lines 104-120):

```ts
export type LoginState = { error?: string };

export async function loginAction(
  _prevState: LoginState,
  formData: FormData
): Promise<LoginState> {
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const password = String(formData.get("password") ?? "");

  try {
    await signIn("credentials", { email, password, redirectTo: "/" });
  } catch (error) {
    if (error instanceof AccountDeletionPendingError) {
      return {
        error: `탈퇴 처리 중인 계정입니다. 복구를 원하시면 ${SUPPORT_EMAIL}으로 문의해주세요.`,
      };
    }
    if (error instanceof AuthError) {
      return { error: "이메일 또는 비밀번호가 올바르지 않습니다." };
    }
    throw error;
  }
  return {};
}
```

- [ ] **Step 4: Add `requestAccountDeletionAction`**

Add this immediately after `logoutAction` (currently lines 122-124):

```ts
export async function logoutAction() {
  await signOut({ redirectTo: "/" });
}

// 탈퇴를 접수하고, 세션을 즉시 만료시킨 뒤 안내 메시지와 함께 로그인 화면으로 보낸다.
export async function requestAccountDeletionAction() {
  const sellerId = await getCurrentSellerId();
  if (!sellerId) {
    redirect("/login");
  }

  await requestAccountDeletion(sellerId);
  await signOut({ redirectTo: "/login?accountDeleted=1" });
}
```

- [ ] **Step 5: Typecheck**

Run: `npx tsc --noEmit`
Expected: no new errors.

- [ ] **Step 6: Manual verification (deferred to Task 13)**

- [ ] **Step 7: Commit**

```bash
git add app/authActions.ts
git commit -m "$(cat <<'EOF'
add requestAccountDeletionAction, signup consent check, deletion-pending login message

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01LDgUbxopUWxwaVM3iqL6wa
EOF
)"
```

---

### Task 9: Signup consent checkbox

**Files:**
- Modify: `app/signup/SignupForm.tsx`

**Interfaces:**
- Consumes: `agreedToPrivacy` form field, checked server-side by Task 8 Step 2.

- [ ] **Step 1: Import `Link` and add checkbox state**

At the top of `app/signup/SignupForm.tsx`, add the import (after the existing `next/navigation`-free import block — there's no `next/link` import yet):

```tsx
"use client";

import Link from "next/link";
import { useRef, useState, useTransition } from "react";
import {
  checkEmailAvailabilityAction,
  checkNicknameAvailabilityAction,
  signupAction,
} from "@/app/authActions";
```

Then, in `SignupForm`, add the new piece of state next to the existing ones (after line 59, `const [nicknameInvalidMessage, setNicknameInvalidMessage] = useState<string | null>(null);`):

```ts
  const [nicknameInvalidMessage, setNicknameInvalidMessage] = useState<string | null>(null);
  const [agreedToPrivacy, setAgreedToPrivacy] = useState(false);
```

- [ ] **Step 2: Require it in `canSubmit`**

Replace line 104:

```ts
  const canSubmit =
    emailStatus === "available" && nicknameStatus === "available" && agreedToPrivacy;
```

- [ ] **Step 3: Add the checkbox UI and update the hint text**

Insert the checkbox block right before the submit `<button>` (i.e. right after the password field's closing `</div>` at line 187, before line 189's `<button type="submit" ...>`):

```tsx
      <div className="flex items-start gap-2">
        <input
          id="agreedToPrivacy"
          name="agreedToPrivacy"
          type="checkbox"
          checked={agreedToPrivacy}
          onChange={(event) => setAgreedToPrivacy(event.target.checked)}
          className="mt-0.5 h-4 w-4 rounded border-zinc-300 dark:border-zinc-700"
        />
        <label htmlFor="agreedToPrivacy" className="text-sm text-zinc-700 dark:text-zinc-300">
          <Link
            href="/privacy"
            target="_blank"
            className="font-medium text-zinc-900 underline dark:text-zinc-50"
          >
            개인정보처리방침
          </Link>
          에 동의합니다 (필수)
        </label>
      </div>

      <button
        type="submit"
        disabled={!canSubmit}
        className="mt-2 rounded-full bg-zinc-900 px-5 py-2.5 text-sm font-medium text-white transition-colors hover:bg-zinc-700 disabled:cursor-not-allowed disabled:opacity-40 dark:bg-zinc-50 dark:text-zinc-900 dark:hover:bg-zinc-200"
      >
        가입하기
      </button>
      {!canSubmit && (
        <p className="text-xs text-zinc-400 dark:text-zinc-500">
          이메일/닉네임 중복확인과 개인정보처리방침 동의를 모두 완료해야 가입할 수 있습니다.
        </p>
      )}
```

This replaces the existing final block (old lines 189-200) — the only change inside it is the hint text on the last line; the button itself is unchanged.

- [ ] **Step 4: Verify in the browser**

Run: `npm run dev`, open `/signup`, fill in email/nickname and pass both duplicate checks.
Expected: the "가입하기" button stays disabled until the checkbox is also checked; the checkbox label's "개인정보처리방침" link opens `/privacy` in a new tab.

- [ ] **Step 5: Typecheck**

Run: `npx tsc --noEmit`
Expected: no new errors.

- [ ] **Step 6: Commit**

```bash
git add app/signup/SignupForm.tsx
git commit -m "$(cat <<'EOF'
require privacy policy consent checkbox before signup

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01LDgUbxopUWxwaVM3iqL6wa
EOF
)"
```

---

### Task 10: Login page deletion-scheduled banner

**Files:**
- Modify: `app/login/page.tsx`

**Interfaces:**
- Consumes: the `?accountDeleted=1` query param set by Task 8's `requestAccountDeletionAction` redirect.

- [ ] **Step 1: Add a second banner component**

Add this right after the existing `ResetSuccessBanner` function (currently lines 12-20):

```tsx
// 탈퇴 요청이 접수되어 /login?accountDeleted=1로 돌아왔을 때만 안내 배너를 보여준다.
function AccountDeletionBanner() {
  const searchParams = useSearchParams();
  if (searchParams.get("accountDeleted") !== "1") return null;
  return (
    <p className="mt-6 rounded-lg bg-zinc-100 px-3 py-2 text-sm text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300">
      회원 탈퇴가 접수되었습니다. 계정과 매물 정보는 14일간 보관 후 삭제됩니다.
    </p>
  );
}
```

- [ ] **Step 2: Render it alongside the existing banner**

Replace the existing `<Suspense>` block (currently lines 29-31):

```tsx
      <Suspense fallback={null}>
        <ResetSuccessBanner />
      </Suspense>
      <Suspense fallback={null}>
        <AccountDeletionBanner />
      </Suspense>
```

- [ ] **Step 3: Verify in the browser**

Run: `npm run dev`, visit `/login?accountDeleted=1`.
Expected: the deletion-scheduled banner renders; visiting plain `/login` shows neither banner.

- [ ] **Step 4: Typecheck**

Run: `npx tsc --noEmit`
Expected: no new errors.

- [ ] **Step 5: Commit**

```bash
git add app/login/page.tsx
git commit -m "$(cat <<'EOF'
show a banner on /login after account deletion is requested

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01LDgUbxopUWxwaVM3iqL6wa
EOF
)"
```

---

### Task 11: "회원 탈퇴" link + confirmation page

**Files:**
- Modify: `app/_components/AuthStatus.tsx`
- Create: `app/account/delete/page.tsx`

**Interfaces:**
- Consumes: `requestAccountDeletionAction` from `@/app/authActions` (Task 8), `getCurrentSellerId` from `@/lib/session`, `SUPPORT_EMAIL` from `@/lib/constants` (Task 1).

- [ ] **Step 1: Add the "회원 탈퇴" link next to "로그아웃"**

Replace the logged-in branch of `app/_components/AuthStatus.tsx` (currently lines 17-29):

```tsx
  return (
    <div className="flex items-center gap-3 text-sm">
      <span className="text-zinc-600 dark:text-zinc-300">{session.user.nickname}님</span>
      <Link
        href="/account/delete"
        className="text-xs text-zinc-400 hover:underline dark:text-zinc-500"
      >
        회원 탈퇴
      </Link>
      <form action={logoutAction}>
        <button
          type="submit"
          className="rounded-md border border-zinc-300 px-2 py-1 text-xs text-zinc-600 hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
        >
          로그아웃
        </button>
      </form>
    </div>
  );
```

(`Link` is already imported at the top of this file for the logged-out branch.)

- [ ] **Step 2: Create the confirmation page**

```tsx
// app/account/delete/page.tsx
import { redirect } from "next/navigation";
import { getCurrentSellerId } from "@/lib/session";
import { requestAccountDeletionAction } from "@/app/authActions";
import { SUPPORT_EMAIL } from "@/lib/constants";

export default async function DeleteAccountPage() {
  const sellerId = await getCurrentSellerId();
  if (!sellerId) {
    redirect("/login");
  }

  return (
    <main className="mx-auto w-full max-w-md flex-1 px-6 py-10">
      <h1 className="text-2xl font-bold">회원 탈퇴</h1>
      <p className="mt-4 text-sm leading-relaxed text-zinc-700 dark:text-zinc-300">
        탈퇴 시 계정과 등록한 매물 정보는 14일간 보관 후 영구 삭제됩니다. 14일 이내에는{" "}
        {SUPPORT_EMAIL}로 연락 주시면 복구 가능합니다.
      </p>
      <form action={requestAccountDeletionAction} className="mt-8">
        <button
          type="submit"
          className="w-full rounded-full bg-red-600 px-5 py-2.5 text-sm font-medium text-white transition-colors hover:bg-red-700"
        >
          탈퇴 확인 및 계정 삭제
        </button>
      </form>
    </main>
  );
}
```

- [ ] **Step 3: Verify in the browser**

Run: `npm run dev`, log in, confirm "회원 탈퇴" appears next to "로그아웃" in the header and links to `/account/delete`, and that the confirmation page shows the exact warning text with the correct email.

- [ ] **Step 4: Typecheck**

Run: `npx tsc --noEmit`
Expected: no new errors.

- [ ] **Step 5: Commit**

```bash
git add app/_components/AuthStatus.tsx app/account/delete/page.tsx
git commit -m "$(cat <<'EOF'
add account-deletion link and confirmation page

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01LDgUbxopUWxwaVM3iqL6wa
EOF
)"
```

---

### Task 12: Cron purge route + Vercel Cron config

**Files:**
- Create: `app/api/cron/purge-deleted-accounts/route.ts`
- Create: `vercel.json`
- Modify: `.env.example`

**Interfaces:**
- Consumes: `purgeExpiredDeletedAccounts` from `@/lib/data` (Task 6), `process.env.CRON_SECRET`.

- [ ] **Step 1: Create the route**

```ts
// app/api/cron/purge-deleted-accounts/route.ts
import { NextResponse } from "next/server";
import { purgeExpiredDeletedAccounts } from "@/lib/data";

// Vercel Cron이 매일 호출한다 (vercel.json 참고). 외부에서 함부로 호출하지 못하도록
// CRON_SECRET과 정확히 일치하는 Authorization: Bearer 헤더를 요구한다.
// CRON_SECRET이 아예 설정되지 않은 경우까지 명시적으로 거부해야, 헤더를 아예 보내지
// 않은 요청이 "undefined === undefined"로 우연히 통과하는 일이 없다.
export async function GET(request: Request) {
  const cronSecret = process.env.CRON_SECRET;
  const authHeader = request.headers.get("authorization");

  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { purgedCount } = await purgeExpiredDeletedAccounts();
  return NextResponse.json({ purgedCount });
}
```

- [ ] **Step 2: Add the Vercel Cron schedule**

```json
{
  "crons": [
    {
      "path": "/api/cron/purge-deleted-accounts",
      "schedule": "0 19 * * *"
    }
  ]
}
```

(19:00 UTC = 04:00 KST the next day, i.e. "매일 새벽 4시 KST".)

- [ ] **Step 3: Document the new env var**

Append to the end of `.env.example`:

```
# 계정 영구 삭제 배치(app/api/cron/purge-deleted-accounts)를 외부에서 함부로 호출하지
# 못하도록 검증하는 값입니다. `openssl rand -hex 32`로 생성해서 채우고, Vercel
# 프로젝트의 환경 변수에도 동일한 값을 등록해주세요 (Vercel Cron이 자동으로
# Authorization: Bearer <CRON_SECRET> 헤더를 붙여 호출합니다).
CRON_SECRET=
```

- [ ] **Step 4: Typecheck**

Run: `npx tsc --noEmit`
Expected: no new errors.

- [ ] **Step 5: Commit**

```bash
git add app/api/cron/purge-deleted-accounts/route.ts vercel.json .env.example
git commit -m "$(cat <<'EOF'
add daily cron route to hard-delete expired accounts

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01LDgUbxopUWxwaVM3iqL6wa
EOF
)"
```

**Manual follow-up (cannot be done from the repo):** set `CRON_SECRET` to a real random value in both `.env.local` (for Task 13's local test) and the Vercel project's environment variables (Production) before deploying, otherwise the route always 401s.

---

### Task 13: End-to-end verification, build check, cleanup

**Files:** none created — this task only runs commands and, if it creates any scratch scripts, deletes them again before finishing.

- [ ] **Step 1: Deletion → immediate logout + listing hidden**

With the dev server running (`npm run dev`) and `CRON_SECRET` set in `.env.local`:
1. Sign up a fresh test account, verify or skip verification, and publish a test listing so it shows on `/`.
2. Log in as that account, click "회원 탈퇴" → confirm on `/account/delete`.
3. Confirm you land on `/login?accountDeleted=1` with the banner from Task 10, and that you are logged out (header shows "로그인"/"회원가입", not the nickname).
4. Reload `/` and confirm the test listing no longer appears.

Expected: all four checks pass.

- [ ] **Step 2: Blocked re-login while deletion is pending**

Attempt to log in again with the same test account's correct email/password on `/login`.
Expected: login is rejected with the exact message `탈퇴 처리 중인 계정입니다. 복구를 원하시면 dohyung.p03@gmail.com으로 문의해주세요.` (rendered via `state.error`), and you are not redirected to `/`.

- [ ] **Step 3: Cron purge actually deletes**

1. Backdate the test account's `deletion_requested_at` to 15 days ago, e.g.:
   ```bash
   psql "$DATABASE_URL" -c "UPDATE sellers SET deletion_requested_at = (now() - interval '15 days')::text WHERE email = 'YOUR_TEST_EMAIL'"
   ```
2. Call the cron route directly with the correct secret:
   ```bash
   curl -i -H "Authorization: Bearer $CRON_SECRET" http://localhost:3000/api/cron/purge-deleted-accounts
   ```
   Expected: `200 OK` with a JSON body like `{"purgedCount":1}` (or more, if other accounts were also eligible).
3. Confirm the account and its listing(s) are gone:
   ```bash
   psql "$DATABASE_URL" -c "SELECT * FROM sellers WHERE email = 'YOUR_TEST_EMAIL'"
   ```
   Expected: zero rows.
4. Call the route again without the header (`curl -i http://localhost:3000/api/cron/purge-deleted-accounts`) and confirm it returns `401`.

- [ ] **Step 4: Full verification suite**

Run, in order:
```bash
npx vitest run
npx tsc --noEmit
npm run build
```
Expected: all three pass with no errors (vitest: all suites including the new `lib/data.test.ts`; `tsc`: zero errors; `build`: production build succeeds).

- [ ] **Step 5: Clean up temporary test data and scripts**

- Delete any test seller account(s)/listings created in Step 1 that survived (if Step 3 didn't already purge them, remove manually via `psql`).
- Delete any ad-hoc scratch scripts created during this verification (e.g. anything dropped in the repo root for manual testing) — none should be committed.
- Run `git status` and confirm no stray files remain before considering the feature done.

- [ ] **Step 6: Final commit (only if cleanup touched tracked files)**

If `git status` shows no changes, skip this step. Otherwise:

```bash
git add -A
git commit -m "$(cat <<'EOF'
clean up verification scratch files

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01LDgUbxopUWxwaVM3iqL6wa
EOF
)"
```
