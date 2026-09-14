#!/usr/bin/env node
// 1회성 데모 데이터 시드 스크립트 (라운드5).
//
// 자동 실행되지 않는다 - 명시적으로 `node scripts/seed-demo-round5.mjs <phase>`로만 실행한다.
// 실제 서버(REST API/서버 액션)를 그대로 호출해 요청을 생성한다 - DB에 상태를
// 직접 꽂아 넣지 않는다(딱 하나 예외: 기존 "툴허브데모" 계정의 비밀번호 재설정만
// bcryptjs로 해시해 sellers.password_hash를 직접 갱신한다 - 이메일 재설정
// 플로우를 거치지 않기 위함).
//
// 필요 환경변수:
//   BASE_URL              대상 배포 URL (예: 라운드5 프리뷰)
//   VERCEL_BYPASS_SECRET  Vercel Deployment Protection 우회 시크릿(프리뷰에만 필요)
//   DEMO_SEED_PASSWORD    데모 계정 공통 비밀번호(코드에 평문 없음)
//   DATABASE_URL          "툴허브데모" 계정 비밀번호 재설정에만 사용
//
// 실행 예: node scripts/seed-demo-round5.mjs all
//         node scripts/seed-demo-round5.mjs reset-password
//         node scripts/seed-demo-round5.mjs signup
//         node scripts/seed-demo-round5.mjs requests
//         node scripts/seed-demo-round5.mjs proposals
//         node scripts/seed-demo-round5.mjs select
//         node scripts/seed-demo-round5.mjs deliver
//         node scripts/seed-demo-round5.mjs complete
//         node scripts/seed-demo-round5.mjs disclosure
//
// 각 phase는 이전 phase가 만든 id를 scripts/.seed-state.json(git-ignored)에서
// 읽는다 - 중간에 끊겨도 이어서 실행할 수 있다.

import { execFileSync } from "node:child_process";
import { mkdtempSync, writeFileSync, readFileSync, existsSync, mkdirSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

const BASE_URL = process.env.BASE_URL;
const BYPASS = process.env.VERCEL_BYPASS_SECRET;
const PASSWORD = process.env.DEMO_SEED_PASSWORD;
const DATABASE_URL = process.env.DATABASE_URL;
const STATE_FILE = path.join(import.meta.dirname, ".seed-state.json");

function requireEnv(name, value) {
  if (!value) throw new Error(`환경변수 ${name}가 필요합니다.`);
  return value;
}

function loadState() {
  if (!existsSync(STATE_FILE)) return {};
  return JSON.parse(readFileSync(STATE_FILE, "utf8"));
}

function saveState(state) {
  writeFileSync(STATE_FILE, JSON.stringify(state, null, 2));
}

// ---- 쿠키 세션 ----

class Session {
  constructor() {
    this.cookies = new Map();
    if (BYPASS) {
      // 최초 요청에서 bypass 쿠키를 심는다.
    }
  }

  cookieHeader() {
    return Array.from(this.cookies.entries())
      .map(([k, v]) => `${k}=${v}`)
      .join("; ");
  }

  absorbSetCookie(res) {
    const raw = res.headers.getSetCookie ? res.headers.getSetCookie() : [];
    for (const line of raw) {
      const [pair] = line.split(";");
      const eq = pair.indexOf("=");
      if (eq === -1) continue;
      const key = pair.slice(0, eq).trim();
      const value = pair.slice(eq + 1).trim();
      this.cookies.set(key, value);
    }
  }

  async fetch(pathname, init = {}) {
    const url = `${BASE_URL}${pathname}`;
    const headers = new Headers(init.headers || {});
    const cookieHeader = this.cookieHeader();
    if (cookieHeader) headers.set("cookie", cookieHeader);
    if (BYPASS) {
      headers.set("x-vercel-protection-bypass", BYPASS);
      headers.set("x-vercel-set-bypass-cookie", "true");
    }
    const res = await fetch(url, { ...init, headers, redirect: "manual" });
    this.absorbSetCookie(res);
    return res;
  }

  // GET은 Vercel Deployment Protection의 bypass 쿠키 세팅용 307 자체 리다이렉트를
  // 한 번 거칠 수 있으므로(첫 요청에만 발생), 리다이렉트를 최대 5회 따라간다.
  // POST(fetch())는 303을 성공 신호로 직접 확인해야 해서 여기서 따로 다룬다.
  async getText(pathname) {
    let currentPath = pathname;
    for (let i = 0; i < 5; i++) {
      const res = await this.fetch(currentPath);
      if (res.status >= 300 && res.status < 400 && res.headers.get("location")) {
        currentPath = res.headers.get("location");
        continue;
      }
      const text = await res.text();
      return { res, text };
    }
    throw new Error(`리다이렉트가 너무 많습니다: ${pathname}`);
  }
}

// ---- useActionState 바인딩 추출 (signup/login/submitDeliveryAction 공통) ----

function extractBoundAction(html) {
  const refMatch = html.match(/\$ACTION_REF_(\d+)/);
  const idMatch = html.match(/name="\$ACTION_(\d+):0" value="([^"]*)"/);
  const boundMatch = html.match(/name="\$ACTION_(\d+):1" value="([^"]*)"/);
  const keyMatch = html.match(/name="\$ACTION_KEY" value="([^"]*)"/);
  if (!refMatch || !idMatch || !boundMatch || !keyMatch) {
    throw new Error("useActionState 바인딩 필드를 찾지 못했습니다. HTML 구조가 바뀌었을 수 있습니다.");
  }
  const n = refMatch[1];
  return {
    ref: `$ACTION_REF_${n}`,
    idField: `$ACTION_${n}:0`,
    idValue: decodeHtmlEntities(idMatch[2]),
    boundField: `$ACTION_${n}:1`,
    boundValue: decodeHtmlEntities(boundMatch[2]),
    keyValue: decodeHtmlEntities(keyMatch[1]),
  };
}

function decodeHtmlEntities(s) {
  return s.replace(/&quot;/g, '"').replace(/&#x27;/g, "'").replace(/&amp;/g, "&");
}

// 특정 hidden 필드(예: requestId=<값>) 근처에 있는 $ACTION_ID_<hash>를 찾는다.
// 페이지에 여러 폼(헤더 로그아웃 폼 등)이 있을 수 있으므로 컨텍스트로 구분한다.
function extractPlainActionNear(html, anchorFieldName, anchorValue) {
  const anchor = `name="${anchorFieldName}" value="${anchorValue}"`;
  const anchorIndex = html.indexOf(anchor);
  if (anchorIndex === -1) {
    throw new Error(`앵커 필드를 찾지 못했습니다: ${anchorFieldName}=${anchorValue}`);
  }
  // 앵커 앞쪽 800자 이내에서 가장 가까운 $ACTION_ID_를 찾는다(같은 <form> 안에 있음).
  const windowStart = Math.max(0, anchorIndex - 800);
  const before = html.slice(windowStart, anchorIndex);
  const matches = [...before.matchAll(/\$ACTION_ID_([a-z0-9]+)/g)];
  if (matches.length === 0) {
    throw new Error(`앵커(${anchorFieldName}=${anchorValue}) 근처에서 액션 id를 찾지 못했습니다.`);
  }
  return matches[matches.length - 1][1];
}

// ---- 이미지/zip 생성 ----

async function makeSampleImageBuffer(seed) {
  const sharp = (await import("sharp")).default;
  const hue = seed * 47 % 360;
  const [r, g, b] = hslToRgb(hue / 360, 0.55, 0.6);
  return sharp({
    create: { width: 480, height: 360, channels: 3, background: { r, g, b } },
  })
    .jpeg()
    .toBuffer();
}

function hslToRgb(h, s, l) {
  let r, g, b;
  if (s === 0) {
    r = g = b = l;
  } else {
    const hue2rgb = (p, q, t) => {
      if (t < 0) t += 1;
      if (t > 1) t -= 1;
      if (t < 1 / 6) return p + (q - p) * 6 * t;
      if (t < 1 / 2) return q;
      if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
      return p;
    };
    const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
    const p = 2 * l - q;
    r = hue2rgb(p, q, h + 1 / 3);
    g = hue2rgb(p, q, h);
    b = hue2rgb(p, q, h - 1 / 3);
  }
  return [Math.round(r * 255), Math.round(g * 255), Math.round(b * 255)];
}

function buildAttendanceZip() {
  const dir = mkdtempSync(path.join(tmpdir(), "attendance-demo-"));
  writeFileSync(
    path.join(dir, "main.py"),
    `import csv
from collections import defaultdict

INPUT_FILE = "출결_샘플.csv"
OUTPUT_FILE = "출결_집계_결과.csv"


def main():
    counts = defaultdict(lambda: {"출석": 0, "결석": 0, "지각": 0})
    with open(INPUT_FILE, encoding="utf-8-sig", newline="") as f:
        reader = csv.DictReader(f)
        for row in reader:
            name = row["이름"]
            status = row["상태"]
            if status in counts[name]:
                counts[name][status] += 1

    with open(OUTPUT_FILE, "w", encoding="utf-8-sig", newline="") as f:
        writer = csv.writer(f)
        writer.writerow(["이름", "출석", "결석", "지각"])
        for name, s in counts.items():
            writer.writerow([name, s["출석"], s["결석"], s["지각"]])

    print(f"집계 완료: {OUTPUT_FILE}")


if __name__ == "__main__":
    main()
`
  );
  writeFileSync(
    path.join(dir, "출결_샘플.csv"),
    `이름,날짜,상태
김민준,2026-09-01,출석
김민준,2026-09-02,결석
이서연,2026-09-01,출석
이서연,2026-09-02,지각
박도윤,2026-09-01,출석
박도윤,2026-09-02,출석
`
  );
  writeFileSync(
    path.join(dir, "README.md"),
    `# 학원 출결 엑셀 자동 집계

## 사용 방법
1. 학원 출결부를 엑셀에서 CSV로 내보냅니다(다른 이름으로 저장 → CSV UTF-8),
   \`출결_샘플.csv\`와 같은 형식(이름, 날짜, 상태)으로 저장해주세요.
2. 이 폴더에서 \`python main.py\` 를 실행합니다.
3. \`출결_집계_결과.csv\` 파일이 생성됩니다. 엑셀로 열면 학생별
   출석/결석/지각 횟수를 바로 확인할 수 있습니다.

## 요구 사항
- Python 3.8 이상 (표준 라이브러리만 사용, 별도 설치 불필요)
`
  );
  const zipPath = path.join(dir, "delivery.zip");
  execFileSync("zip", ["-q", "-j", zipPath, path.join(dir, "main.py"), path.join(dir, "출결_샘플.csv"), path.join(dir, "README.md")]);
  return readFileSync(zipPath);
}

// ---- 계정/시드 데이터 정의 ----

const ACCOUNTS = {
  makerA: {
    reuse: true,
    id: "e6a251f1-b6e5-49c8-ac37-a533f4a99436",
    email: "demo1788687956550@example.com",
    nickname: "툴허브데모",
  },
  makerB: {
    email: "dohyung.p03+demoMakerB@gmail.com",
    nickname: "프리랜서개발자",
  },
  requester1: {
    email: "dohyung.p03+demoRequester1@gmail.com",
    nickname: "자영업사장님",
  },
  requester2: {
    email: "dohyung.p03+demoRequester2@gmail.com",
    nickname: "마케팅담당자",
  },
};

function kstDatePlusDays(days) {
  const now = new Date(Date.now() + 9 * 60 * 60 * 1000 + days * 24 * 60 * 60 * 1000);
  return now.toISOString().slice(0, 10);
}

const REQUESTS = [
  {
    key: "completed_attendance",
    title: "학원 출결 엑셀 자동 집계",
    description:
      "학원에서 매일 손으로 적는 출결부를 엑셀로 자동 집계해주는 프로그램이 필요합니다. 학생별 출석/결석/지각 현황을 한눈에 정리해서 보여주면 좋겠습니다.",
    budgetAmount: 80000,
    budgetNegotiable: false,
    requiredEnvironment: "Windows",
    desiredDeadline: kstDatePlusDays(14),
    requester: "requester1",
  },
  {
    key: "open_shopping_mall",
    title: "쇼핑몰 주문 엑셀 정리",
    description:
      "스마트스토어에서 다운받은 주문 내역 엑셀을 매일 손으로 정리하는 게 번거롭습니다. 자동으로 정리해주는 프로그램을 찾고 있어요.",
    budgetAmount: 150000,
    budgetNegotiable: false,
    requiredEnvironment: "Windows",
    desiredDeadline: kstDatePlusDays(20),
    requester: "requester1",
  },
  {
    key: "open_form_survey",
    title: "구글폼 설문 응답 엑셀 자동 정리",
    description:
      "구글폼으로 받는 설문 응답을 매번 엑셀로 옮겨 정리하고 있는데, 이 과정을 자동으로 처리해주는 프로그램이 필요합니다.",
    budgetAmount: null,
    budgetNegotiable: true,
    requiredEnvironment: "제한 없음",
    desiredDeadline: kstDatePlusDays(30),
    requester: "requester1",
  },
  {
    key: "open_instagram",
    title: "인스타 게시물 예약 업로드",
    description:
      "정해진 시간에 인스타그램 게시물을 자동으로 올려주는 프로그램이 필요합니다. 여러 장 사진과 문구를 미리 등록해두고 싶어요.",
    budgetAmount: 100000,
    budgetNegotiable: false,
    requiredEnvironment: "제한 없음",
    desiredDeadline: kstDatePlusDays(25),
    requester: "requester2",
  },
  {
    key: "in_progress_naver_place",
    title: "네이버 플레이스 리뷰 알림",
    description:
      "네이버 플레이스에 새 리뷰가 달리면 바로 알림을 받고 싶습니다. 리뷰 내용과 별점을 함께 알려주면 좋겠어요.",
    budgetAmount: 120000,
    budgetNegotiable: false,
    requiredEnvironment: "Windows",
    desiredDeadline: kstDatePlusDays(18),
    requester: "requester2",
  },
];

const PROPOSALS = [
  // 완료 건: makerA가 제안 → 선택 → 납품까지 전 과정 진행
  { requestKey: "completed_attendance", maker: "makerA", price: 80000, completionDays: 5, description: "3일 안에 견본을 먼저 보여드리고, 확인 후 마무리하겠습니다. 엑셀/CSV 형식 모두 지원 가능합니다." },
  // 모집중: 구글폼 설문 - makerB 제안 1건(미선택)
  { requestKey: "open_form_survey", maker: "makerB", price: 60000, completionDays: 10, description: "구글 시트 연동으로 실시간 자동 정리가 가능하도록 만들어드리겠습니다." },
  // 모집중: 인스타 예약 업로드 - makerA/makerB 둘 다 제안(미선택)
  { requestKey: "open_instagram", maker: "makerA", price: 110000, completionDays: 12, description: "예약 시간과 게시물 내용을 엑셀로 관리할 수 있게 만들어드립니다." },
  { requestKey: "open_instagram", maker: "makerB", price: 90000, completionDays: 15, description: "간단한 스케줄 파일만 채우면 자동으로 업로드되도록 구현하겠습니다." },
  // 진행중: 네이버 플레이스 - makerA 제안 → 선택(진행중, 납품 전)
  { requestKey: "in_progress_naver_place", maker: "makerA", price: 120000, completionDays: 8, description: "새 리뷰 발생 시 카카오톡/이메일로 알림을 보내드리겠습니다." },
];

// ---- HTTP 헬퍼 ----

async function signup(session, { email, password, nickname }) {
  const { text: page } = await session.getText("/signup");
  const bound = extractBoundAction(page);
  const form = new FormData();
  form.set(bound.ref, "");
  form.set(bound.idField, bound.idValue);
  form.set(bound.boundField, bound.boundValue);
  form.set("$ACTION_KEY", bound.keyValue);
  form.set("email", email);
  form.set("password", password);
  form.set("nickname", nickname);
  form.set("agreedToPrivacy", "on");
  form.set("next", "");
  const res = await session.fetch("/signup", { method: "POST", body: form });
  if (res.status !== 303) {
    const body = await res.text();
    throw new Error(`signup 실패(${email}): HTTP ${res.status}\n${body.slice(0, 500)}`);
  }
}

async function login(session, { email, password }) {
  const { text: page } = await session.getText("/login");
  const bound = extractBoundAction(page);
  const form = new FormData();
  form.set(bound.ref, "");
  form.set(bound.idField, bound.idValue);
  form.set(bound.boundField, bound.boundValue);
  form.set("$ACTION_KEY", bound.keyValue);
  form.set("email", email);
  form.set("password", password);
  form.set("next", "");
  const res = await session.fetch("/login", { method: "POST", body: form });
  if (res.status !== 303) {
    const body = await res.text();
    throw new Error(`login 실패(${email}): HTTP ${res.status}\n${body.slice(0, 500)}`);
  }
}

async function createRequest(session, def, imageSeed) {
  const form = new FormData();
  form.set("title", def.title);
  form.set("description", def.description);
  if (def.budgetAmount !== null) form.set("budgetAmount", String(def.budgetAmount));
  if (def.budgetNegotiable) form.set("budgetNegotiable", "on");
  form.set("requiredEnvironment", def.requiredEnvironment);
  if (def.desiredDeadline) form.set("desiredDeadline", def.desiredDeadline);
  const imgBuffer = await makeSampleImageBuffer(imageSeed);
  form.set("images", new Blob([imgBuffer], { type: "image/jpeg" }), "sample.jpg");
  const res = await session.fetch("/api/requests", { method: "POST", body: form });
  const body = await res.json();
  if (res.status !== 201) {
    throw new Error(`요청 생성 실패(${def.title}): HTTP ${res.status} ${JSON.stringify(body)}`);
  }
  return body.id;
}

async function createProposal(session, requestId, def) {
  const res = await session.fetch(`/api/requests/${requestId}/proposals`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      price: def.price,
      proposedCompletionDate: kstDatePlusDays(def.completionDays),
      description: def.description,
    }),
  });
  const body = await res.json();
  if (res.status !== 201) {
    throw new Error(`제안 생성 실패: HTTP ${res.status} ${JSON.stringify(body)}`);
  }
  return body.id;
}

async function selectProposal(session, requestId, proposalId) {
  const res = await session.fetch(`/api/requests/${requestId}/proposals/${proposalId}/select`, {
    method: "POST",
  });
  const body = await res.json();
  if (res.status !== 200) {
    throw new Error(`제안 선택 실패: HTTP ${res.status} ${JSON.stringify(body)}`);
  }
}

async function submitDelivery(session, requestId, proposalId) {
  const { text: page } = await session.getText(`/requests/${requestId}/deliver`);
  const bound = extractBoundAction(page);
  const zipBuffer = buildAttendanceZip();
  const proofBuffer = await makeSampleImageBuffer(99);

  const form = new FormData();
  form.set(bound.ref, "");
  form.set(bound.idField, bound.idValue);
  form.set(bound.boundField, bound.boundValue);
  form.set("$ACTION_KEY", bound.keyValue);
  form.set("requestId", requestId);
  form.set("proposalId", proposalId);
  form.set("sourceType", "zip");
  form.set("zipFile", new Blob([zipBuffer], { type: "application/zip" }), "delivery.zip");
  form.set(
    "deliveryGuide",
    "python main.py 로 실행하면 같은 폴더의 출결_샘플.csv를 읽어 출결_집계_결과.csv를 만듭니다. 자세한 사용법은 README.md를 참고해주세요."
  );
  form.set("proofImages", new Blob([proofBuffer], { type: "image/jpeg" }), "proof.jpg");

  const res = await session.fetch(`/requests/${requestId}/deliver`, { method: "POST", body: form });
  if (res.status !== 303) {
    const body = await res.text();
    throw new Error(`납품 제출 실패: HTTP ${res.status}\n${body.slice(0, 800)}`);
  }
}

async function submitPlainAction(session, pagePath, actionPath, anchorFieldName, anchorValue, extraFields) {
  const { text: page } = await session.getText(pagePath);
  const actionHash = extractPlainActionNear(page, anchorFieldName, anchorValue);
  const form = new FormData();
  form.set(`$ACTION_ID_${actionHash}`, "");
  for (const [k, v] of Object.entries(extraFields)) form.set(k, v);
  const res = await session.fetch(actionPath, { method: "POST", body: form });
  if (res.status !== 303) {
    const body = await res.text();
    throw new Error(`${actionPath} 실패: HTTP ${res.status}\n${body.slice(0, 800)}`);
  }
}

// ---- phases ----

async function phaseResetPassword() {
  requireEnv("DATABASE_URL", DATABASE_URL);
  requireEnv("DEMO_SEED_PASSWORD", PASSWORD);
  const bcrypt = (await import("bcryptjs")).default;
  const { neon } = await import("@neondatabase/serverless");
  const sql = neon(DATABASE_URL);
  const hash = await bcrypt.hash(PASSWORD, 12);
  const rows = await sql`UPDATE sellers SET password_hash = ${hash} WHERE id = ${ACCOUNTS.makerA.id} RETURNING id`;
  console.log("makerA 비밀번호 재설정:", JSON.stringify(rows));
}

async function phaseSignup() {
  requireEnv("BASE_URL", BASE_URL);
  requireEnv("DEMO_SEED_PASSWORD", PASSWORD);
  const state = loadState();
  state.accounts = state.accounts || {};
  for (const key of ["makerB", "requester1", "requester2"]) {
    const acc = ACCOUNTS[key];
    const session = new Session();
    await signup(session, { email: acc.email, password: PASSWORD, nickname: acc.nickname });
    console.log(`signup 완료: ${key} (${acc.email})`);
  }
  saveState(state);
}

async function loginAll() {
  const sessions = {};
  for (const key of Object.keys(ACCOUNTS)) {
    const acc = ACCOUNTS[key];
    const session = new Session();
    await login(session, { email: acc.email, password: PASSWORD });
    sessions[key] = session;
  }
  return sessions;
}

async function phaseRequests() {
  requireEnv("BASE_URL", BASE_URL);
  requireEnv("DEMO_SEED_PASSWORD", PASSWORD);
  const state = loadState();
  const sessions = await loginAll();
  state.requestIds = state.requestIds || {};
  let seed = 1;
  for (const def of REQUESTS) {
    const session = sessions[def.requester];
    const id = await createRequest(session, def, seed++);
    state.requestIds[def.key] = id;
    console.log(`요청 생성: ${def.key} -> ${id}`);
  }
  saveState(state);
}

async function phaseProposals() {
  requireEnv("BASE_URL", BASE_URL);
  requireEnv("DEMO_SEED_PASSWORD", PASSWORD);
  const state = loadState();
  const sessions = await loginAll();
  state.proposalIds = state.proposalIds || {};
  for (const [i, def] of PROPOSALS.entries()) {
    const requestId = state.requestIds[def.requestKey];
    if (!requestId) throw new Error(`requestId 없음: ${def.requestKey} (requests phase를 먼저 실행하세요)`);
    const session = sessions[def.maker];
    const proposalId = await createProposal(session, requestId, def);
    state.proposalIds[`${def.requestKey}:${def.maker}`] = proposalId;
    console.log(`제안 생성: ${def.requestKey} by ${def.maker} -> ${proposalId}`);
  }
  saveState(state);
}

async function phaseSelect() {
  requireEnv("BASE_URL", BASE_URL);
  requireEnv("DEMO_SEED_PASSWORD", PASSWORD);
  const state = loadState();
  const sessions = await loginAll();

  const completedRequestId = state.requestIds.completed_attendance;
  const completedProposalId = state.proposalIds["completed_attendance:makerA"];
  await selectProposal(sessions.requester1, completedRequestId, completedProposalId);
  console.log("선택 완료: 완료 건(학원 출결) - makerA");

  const inProgressRequestId = state.requestIds.in_progress_naver_place;
  const inProgressProposalId = state.proposalIds["in_progress_naver_place:makerA"];
  await selectProposal(sessions.requester2, inProgressRequestId, inProgressProposalId);
  console.log("선택 완료: 진행중 건(네이버 플레이스) - makerA");
}

async function phaseDeliver() {
  requireEnv("BASE_URL", BASE_URL);
  requireEnv("DEMO_SEED_PASSWORD", PASSWORD);
  const state = loadState();
  const sessions = await loginAll();

  const requestId = state.requestIds.completed_attendance;
  const proposalId = state.proposalIds["completed_attendance:makerA"];
  await submitDelivery(sessions.makerA, requestId, proposalId);
  console.log("납품 제출 완료(스캔 통과 시 자동으로 확정됨)");
}

async function phaseComplete() {
  requireEnv("BASE_URL", BASE_URL);
  requireEnv("DEMO_SEED_PASSWORD", PASSWORD);
  const state = loadState();
  const sessions = await loginAll();

  const requestId = state.requestIds.completed_attendance;
  const proposalId = state.proposalIds["completed_attendance:makerA"];

  await submitPlainAction(
    sessions.requester1,
    `/requests/${requestId}`,
    `/requests/${requestId}`,
    "proposalId",
    proposalId,
    { requestId, proposalId }
  );
  console.log("의뢰자 수락 완료");

  await submitPlainAction(
    sessions.requester1,
    `/requests/${requestId}`,
    `/requests/${requestId}`,
    "proposalId",
    proposalId,
    { requestId, proposalId }
  );
  console.log("이체 완료 표시");

  await submitPlainAction(
    sessions.makerA,
    `/requests/${requestId}`,
    `/requests/${requestId}`,
    "proposalId",
    proposalId,
    { requestId, proposalId }
  );
  console.log("입금 확인 완료(의뢰 완료 처리됨)");
}

async function phaseDisclosure() {
  requireEnv("BASE_URL", BASE_URL);
  requireEnv("DEMO_SEED_PASSWORD", PASSWORD);
  const state = loadState();
  const sessions = await loginAll();
  const requestId = state.requestIds.completed_attendance;

  const form = new FormData();
  const { text: page } = await sessions.requester1.getText(`/requests/${requestId}`);
  const actionHash = extractPlainActionNear(page, "requestId", requestId);
  form.set(`$ACTION_ID_${actionHash}`, "");
  form.set("requestId", requestId);
  form.set("completedContentPublic", "on");
  form.set("makerAttributionPublic", "on");
  const res = await sessions.requester1.fetch(`/requests/${requestId}`, { method: "POST", body: form });
  if (res.status !== 303) {
    const body = await res.text();
    throw new Error(`공개 설정 실패: HTTP ${res.status}\n${body.slice(0, 800)}`);
  }
  console.log("완료 사례 공개 설정 완료(completedContentPublic=true, makerAttributionPublic=true)");
}

async function phaseAll() {
  await phaseResetPassword();
  await phaseSignup();
  await phaseRequests();
  await phaseProposals();
  await phaseSelect();
  await phaseDeliver();
  await phaseComplete();
  await phaseDisclosure();
}

const PHASES = {
  "reset-password": phaseResetPassword,
  signup: phaseSignup,
  requests: phaseRequests,
  proposals: phaseProposals,
  select: phaseSelect,
  deliver: phaseDeliver,
  complete: phaseComplete,
  disclosure: phaseDisclosure,
  all: phaseAll,
};

const phase = process.argv[2];
if (!phase || !PHASES[phase]) {
  console.error(`사용법: node scripts/seed-demo-round5.mjs <${Object.keys(PHASES).join("|")}>`);
  process.exit(1);
}

await PHASES[phase]();
console.log(`phase "${phase}" 완료. 상태 파일: ${STATE_FILE}`);
