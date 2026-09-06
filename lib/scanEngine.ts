import "server-only";
import { detectFindings, type RawFinding } from "./detector";
import { reviewAmbiguousFindings } from "./llmReview";
import type { ScannableFile } from "./scannableFile";
import type { Finding } from "./types";

// needsLlmReview 플래그는 내부 판단용이라 저장하는 Finding에는 포함하지 않는다.
function toPersistableFinding(raw: RawFinding): Finding {
  return {
    id: raw.id,
    severity: raw.severity,
    confidence: raw.confidence,
    type: raw.type,
    cwe: raw.cwe,
    filePath: raw.filePath,
    location: raw.location,
    maskedEvidence: raw.maskedEvidence,
    description: raw.description,
  };
}

// 규칙 기반 탐지 → (조건부) LLM 보강을 거쳐 최종 findings를 만드는 오케스트레이터.
// GitHub/zip 어느 입력이든 ScannableFile[]로 통일된 뒤 이 함수 하나로 들어온다.
export async function runScan(files: ScannableFile[]): Promise<Finding[]> {
  const rawFindings = detectFindings(files);
  const reviewedFindings = await reviewAmbiguousFindings(rawFindings, files);
  return reviewedFindings.map(toPersistableFinding);
}
