import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { z } from "zod";
import { redactSecrets, type RawFinding } from "./detector";
import type { ScannableFile } from "./scannableFile";
import { CONFIDENCE_LEVELS, SEVERITIES } from "./types";

const CONTEXT_LINES = 2;

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

// 규칙 기반 탐지기가 "문맥 판단이 필요함"으로 표시한 항목만 골라 Claude에게
// 보강 판단을 요청한다. 애매한 항목이 하나도 없으면 API를 호출하지 않는다
// (모든 스캔에 매번 LLM을 호출하지 않기 위한 비용 통제).
export async function reviewAmbiguousFindings(
  findings: RawFinding[],
  files: ScannableFile[]
): Promise<RawFinding[]> {
  const ambiguous = findings.filter((finding) => finding.needsLlmReview);
  if (ambiguous.length === 0) return findings;
  if (!process.env.ANTHROPIC_API_KEY) return findings;

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
    client = new Anthropic();
  } catch {
    return findings;
  }

  let response;
  try {
    response = await client.messages.parse({
      model: "claude-opus-5",
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
  } catch {
    // LLM 호출이 실패해도 규칙 기반 결과는 이미 유효하므로 그대로 반환한다.
    return findings;
  }

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
