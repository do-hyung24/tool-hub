import { SEVERITIES, type Finding, type Severity } from "./types";

// 구매자에게 공개하는 5개 취약 카테고리. detector.ts가 만드는 세부 type(7종)보다
// 굵직한 분류이고, 세부 type 자체는 판매자 전용(review 화면)으로만 남긴다.
export const CATEGORY_IDS = [
  "secret-exposure",
  "dangerous-code-execution",
  "insecure-network",
  "insecure-deserialization",
  "data-exfiltration",
] as const;

export type CategoryId = (typeof CATEGORY_IDS)[number];

const TYPE_TO_CATEGORY: Record<string, CategoryId> = {
  "hardcoded-secret": "secret-exposure",
  "high-entropy-literal": "secret-exposure",
  "dangerous-eval": "dangerous-code-execution",
  "dangerous-shell": "dangerous-code-execution",
  "insecure-tls": "insecure-network",
  "insecure-deserialization": "insecure-deserialization",
  "data-exfiltration": "data-exfiltration",
};

export function categoryForType(type: string): CategoryId | null {
  return TYPE_TO_CATEGORY[type] ?? null;
}

const EXPERT_LABELS: Record<CategoryId, string> = {
  "secret-exposure": "시크릿/자격 증명 노출",
  "dangerous-code-execution": "위험 함수 호출(eval/셸 실행)",
  "insecure-network": "안전하지 않은 통신(TLS 검증 비활성화)",
  "insecure-deserialization": "안전하지 않은 역직렬화",
  "data-exfiltration": "외부 데이터 전송 패턴",
};

// needsLlmReview:true인 카테고리(LLM 하이브리드가 꺼진 지금은 확정 판단이 아님)는
// 쉬운말 라벨을 단정형이 아니라 "~발견되어 확인이 필요해요" 식으로 완화한다.
// secret-exposure만 예외: hardcoded-secret(확정, needsLlmReview:false)이 하나라도
// 있으면 기존 단정형을 쓰고, high-entropy-literal(불확정)만 있을 때만 완화한다.
const DEFAULT_EASY_LABELS: Record<CategoryId, string> = {
  "secret-exposure": "비밀번호나 API 키로 보이는 값이 발견되어 확인이 필요해요",
  "dangerous-code-execution": "외부 명령을 실행할 수 있는 코드가 발견되어 확인이 필요해요",
  "insecure-network": "인터넷 통신을 안전하지 않은 방식으로 하는 코드가 발견되어 확인이 필요해요",
  "insecure-deserialization": "믿을 수 없는 데이터를 위험하게 불러오는 코드가 발견되어 확인이 필요해요",
  "data-exfiltration": "정보를 외부로 보낼 수 있는 코드가 발견되어 확인이 필요해요",
};

const SECRET_EXPOSURE_DECLARATIVE_EASY_LABEL = "비밀번호나 API 키가 코드에 그대로 적혀 있어요";
const SECRET_EXPOSURE_DECLARATIVE_TRIGGER_TYPE = "hardcoded-secret";

function easyLabelFor(categoryId: CategoryId, typesInGroup: string[]): string {
  if (categoryId === "secret-exposure" && typesInGroup.includes(SECRET_EXPOSURE_DECLARATIVE_TRIGGER_TYPE)) {
    return SECRET_EXPOSURE_DECLARATIVE_EASY_LABEL;
  }
  return DEFAULT_EASY_LABELS[categoryId];
}

export type PublicFindingGroup = {
  categoryId: CategoryId;
  severity: Severity;
  expertLabel: string;
  easyLabel: string;
};

function higherSeverity(a: Severity, b: Severity): Severity {
  return SEVERITIES.indexOf(a) <= SEVERITIES.indexOf(b) ? a : b;
}

// 판매자 전용 세부 findings를, 구매자에게 보여줘도 되는 카테고리 단위 요약으로
// 바꾼다. 원본 type/filePath/location/maskedEvidence/description은 반환값에
// 전혀 포함되지 않는다 - 라벨 문구 선택(declarative vs hedged)에만 내부적으로
// 쓰이고 버려진다.
export function groupFindingsForBuyer(findings: Finding[]): PublicFindingGroup[] {
  const bySeverity = new Map<CategoryId, Severity>();
  const typesByCategory = new Map<CategoryId, string[]>();

  for (const finding of findings) {
    const categoryId = categoryForType(finding.type);
    if (!categoryId) continue;

    const currentSeverity = bySeverity.get(categoryId);
    bySeverity.set(
      categoryId,
      currentSeverity ? higherSeverity(currentSeverity, finding.severity) : finding.severity
    );

    const types = typesByCategory.get(categoryId) ?? [];
    types.push(finding.type);
    typesByCategory.set(categoryId, types);
  }

  return Array.from(bySeverity.entries())
    .map(([categoryId, severity]) => ({
      categoryId,
      severity,
      expertLabel: EXPERT_LABELS[categoryId],
      easyLabel: easyLabelFor(categoryId, typesByCategory.get(categoryId) ?? []),
    }))
    .sort((a, b) => SEVERITIES.indexOf(a.severity) - SEVERITIES.indexOf(b.severity));
}
