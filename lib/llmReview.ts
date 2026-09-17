import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { z } from "zod";
import { redactSecrets, type RawFinding } from "./detector";
import type { ScannableFile } from "./scannableFile";
import { CONFIDENCE_LEVELS, SEVERITIES } from "./types";

const CONTEXT_LINES = 2;

// 오탐 재판정용 모델. 상수로 분리해 opus/haiku 비교 검증 시 한 곳만 바꾸면
// 되게 한다(2026-09-16 라운드 - opus-5/haiku-4-5 비교 후 결정).
const LLM_MODEL = "claude-opus-5";

// SDK 기본 타임아웃(10분)·기본 재시도(2회)를 그대로 쓰면, API가 느려질 때
// 이 함수의 try/catch가 발동하기도 전에 서버리스 함수 자체의 실행 시간
// 제한에 걸려 매물 등록/완성본 제출 요청 전체가 500으로 실패할 수 있다.
// 8초로 짧게 잡아 최악의 경우에도 매물 등록 자체는 항상 완료되게 한다
// (그 대신 규칙 엔진 결과만 남는다 - 아래 catch가 그 경로다).
const LLM_TIMEOUT_MS = 8000;
// 이 프로젝트는 Vercel Hobby 플랜이라 서버리스 함수 실행 시간 제한이 짧다.
// 재시도 1회를 두면 timeout이 attempt당 적용돼(SDK가 매 attempt마다 새로
// 타이머를 검) 최악의 경우 8초×2 + 백오프로 약 16.5초까지 늘어나 함수
// 제한을 넘길 위험이 있다. 재시도로 얻는 복원력보다 500을 안 내는 쪽이
// 우선이라 0으로 낮춘다 - 최악의 경우도 attempt 1회, 약 8초로 고정된다.
const LLM_MAX_RETRIES = 0;

const ReviewItemSchema = z.object({
  id: z.string(),
  severity: z.enum(SEVERITIES),
  confidence: z.enum(CONFIDENCE_LEVELS),
  description: z.string(),
});

const LlmReviewSchema = z.object({
  items: z.array(ReviewItemSchema),
});

function buildRedactedSnippet(file: ScannableFile, lineNumber: number): string {
  const lines = file.content.split("\n");
  const start = Math.max(0, lineNumber - 1 - CONTEXT_LINES);
  const end = Math.min(lines.length, lineNumber + CONTEXT_LINES);
  return redactSecrets(lines.slice(start, end).join("\n"));
}

export type LlmErrorSummary = {
  name: string;
  status: number | null;
  errorType: string | null;
  message: string;
};

// LLM 호출 실패를 실제 서버 로그(Vercel 함수 로그)에도, 검증 전용 진단
// 라우트에도 같은 안전한 필드만 골라 넘긴다 - 키 값은 에러 객체에 담기지
// 않고, message는 만약을 위해 redactSecrets를 한 번 더 거친다. 이전에는
// 이 catch가 에러를 완전히 삼켜서, 모델명 오타나 키 만료로 하이브리드가
// 매번 조용히 규칙 엔진으로 폴백돼도 아무 신호가 없었다.
function summarizeLlmError(error: unknown): LlmErrorSummary {
  if (error instanceof Anthropic.APIError) {
    return {
      name: error.name,
      status: typeof error.status === "number" ? error.status : null,
      errorType: error.type ?? null,
      message: redactSecrets(error.message),
    };
  }
  if (error instanceof Error) {
    return { name: error.name, status: null, errorType: null, message: redactSecrets(error.message) };
  }
  return { name: "unknown", status: null, errorType: null, message: "unknown error" };
}

// 규칙 기반 탐지기가 "문맥 판단이 필요함"으로 표시한 항목만 골라 Claude에게
// 보강 판단을 요청한다. 애매한 항목이 하나도 없으면 API를 호출하지 않는다
// (모든 스캔에 매번 LLM을 호출하지 않기 위한 비용 통제).
export async function reviewAmbiguousFindings(
  findings: RawFinding[],
  files: ScannableFile[],
  // 검증 전용 오버라이드. 실제 서비스 호출부(scanEngine.ts)는 이 값을 넘기지
  // 않으므로 동작에 영향이 없다. app/api/scan-diag/route.ts가 요청 단위로
  // model/timeout을 바꿔보거나 usage 수치를 안전하게(전역 console.log를
  // 건드리지 않고, 동시 요청과 섞이지 않게) 읽어가기 위한 용도.
  overrides?: {
    onUsage?: (usage: { inputTokens: number; outputTokens: number }) => void;
    onError?: (error: LlmErrorSummary) => void;
    model?: string;
    timeoutMs?: number;
  }
): Promise<RawFinding[]> {
  const ambiguous = findings.filter((finding) => finding.needsLlmReview);
  if (ambiguous.length === 0) return findings;
  // 1차 스프린트는 룰기반 탐지만 제공한다. LLM 하이브리드는 스텁 상태이며
  // ENABLE_LLM_HYBRID=true로 명시적으로 켜기 전까지는 API를 호출하지 않는다.
  if (process.env.ENABLE_LLM_HYBRID !== "true") return findings;
  if (!process.env.ANTHROPIC_API_KEY) return findings;

  const model = overrides?.model ?? LLM_MODEL;
  const timeoutMs = overrides?.timeoutMs ?? LLM_TIMEOUT_MS;

  const filesByPath = new Map(files.map((file) => [file.path, file]));

  const itemsForPrompt = ambiguous.map((finding) => {
    const file = filesByPath.get(finding.filePath);
    const snippet = file ? buildRedactedSnippet(file, finding.lineNumber) : "(파일을 찾을 수 없음)";
    return {
      id: finding.id,
      type: finding.type,
      filePath: finding.filePath,
      location: finding.location,
      initialDescription: finding.description,
      // 시크릿 원문은 절대 포함하지 않는다 - 알려진 패턴/고엔트로피 리터럴은
      // redactSecrets()로 마스킹된 상태다.
      redactedCodeSnippet: snippet,
    };
  });

  let client: Anthropic;
  try {
    client = new Anthropic({ timeout: timeoutMs, maxRetries: LLM_MAX_RETRIES });
  } catch (error) {
    const summary = summarizeLlmError(error);
    console.error("[llmReview] client 생성 실패, 규칙 엔진 결과로 폴백", summary);
    overrides?.onError?.(summary);
    return findings;
  }

  let response;
  try {
    response = await client.messages.parse({
      model,
      max_tokens: 4096,
      output_config: {
        effort: "medium",
        format: zodOutputFormat(LlmReviewSchema),
      },
      system:
        "당신은 개인 개발자가 만든 자동화 봇/스크립트 코드를 검수하는 보안 리뷰어입니다. " +
        "규칙 기반 탐지기가 문맥 판단이 필요하다고 표시한 항목들을 검토해, 각 항목의 실제 " +
        "위험도(severity: critical/high/medium/low/informational)와 확신도(confidence: " +
        "high/medium/low)를 다시 판단하세요. 예를 들어 eval/exec/child_process 호출이 " +
        "브라우저 자동화나 정상적인 셸 명령 실행처럼 보이면 severity를 낮추고, 반대로 " +
        "명백히 위험한 동작(예: 원격에서 받은 코드를 그대로 실행)이면 severity를 유지하거나 " +
        "높이세요. 고엔트로피 문자열이 UUID/해시/난독화된 식별자처럼 보이면 severity를 " +
        "informational로 낮추고, 실제 시크릿으로 보이면 유지하세요. description은 한국어로 " +
        "간결하게 다시 작성하세요. 원문 시크릿 값은 이미 마스킹되어 전달되니 그 사실을 " +
        "언급할 필요는 없습니다.",
      messages: [
        {
          role: "user",
          content: JSON.stringify({ findings: itemsForPrompt }, null, 2),
        },
      ],
    });
  } catch (error) {
    const summary = summarizeLlmError(error);
    // LLM 호출이 실패해도 규칙 기반 결과는 이미 유효하므로 그대로 반환하지만,
    // 실패 자체는 반드시 로그로 남긴다 - 이게 없으면 하이브리드가 계속
    // 실패해도 매물 등록은 정상 동작해 아무도 알아채지 못한다.
    console.error("[llmReview] LLM 호출 실패, 규칙 엔진 결과로 폴백", summary);
    overrides?.onError?.(summary);
    return findings;
  }

  // 스캔 1회당 실제 토큰 사용량을 서버 로그로 남긴다 - 등록마다 호출되는
  // 비용이라 관측 없이는 반복 등록으로 새는 비용을 알아챌 방법이 없다.
  console.log("[llmReview] usage", {
    model,
    ambiguousCount: ambiguous.length,
    inputTokens: response.usage.input_tokens,
    outputTokens: response.usage.output_tokens,
  });
  overrides?.onUsage?.({
    inputTokens: response.usage.input_tokens,
    outputTokens: response.usage.output_tokens,
  });

  const reviewed = response.parsed_output?.items;
  if (!reviewed) return findings;

  const reviewById = new Map(reviewed.map((item) => [item.id, item]));

  return findings.map((finding) => {
    const review = reviewById.get(finding.id);
    if (!finding.needsLlmReview || !review) return finding;
    return {
      ...finding,
      severity: review.severity,
      confidence: review.confidence,
      description: review.description,
      needsLlmReview: false,
    };
  });
}
