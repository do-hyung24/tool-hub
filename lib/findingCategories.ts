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

// TYPE_TO_CATEGORY 자체는 비공개(위 categoryForType을 통해서만 조회)라, 랜딩
// 페이지가 "몇 종의 탐지 규칙이 있는지"를 하드코딩하지 않고 이 함수로 읽는다.
export function getDetectorTypeCount(): number {
  return Object.keys(TYPE_TO_CATEGORY).length;
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

// EXPERT_LABELS 자체는 비공개라, 랜딩 페이지의 카테고리 칩 목록이 CATEGORY_IDS
// 순서 그대로 라벨을 뽑아 쓸 수 있도록 이 배열을 export한다.
export const CATEGORY_LABELS: Array<{ id: CategoryId; label: string }> = CATEGORY_IDS.map(
  (id) => ({ id, label: EXPERT_LABELS[id] })
);

// 카테고리 자체가 무엇을 뜻하는지 설명하는 쉬운말 한 줄 - 실제 발견 항목
// (findings)과 무관하게 항상 성립해야 한다("~확인해요" 식 서술, 결과와
// 무관하게 참). DEFAULT_EASY_LABELS는 "~발견되어 확인이 필요해요" 식으로
// 실제 스캔 결과 문맥 전용이라 여기(랜딩 카테고리 칩 툴팁, 매물 상세 체크
// 항목 목록의 "해당 없음" 행)에는 맞지 않는다. 원래 app/page.tsx에
// CATEGORY_TOOLTIPS로 로컬 중복 정의되어 있던 것을 이 파일로 옮겨 단일
// 소스로 합쳤다(문구 자체는 그대로).
export const CATEGORY_CHECK_DESCRIPTIONS: Record<CategoryId, string> = {
  "secret-exposure": "비밀번호나 API 키 같은 값이 코드에 그대로 적혀 있는지 확인해요",
  "dangerous-code-execution": "외부 명령을 실행할 수 있는 위험한 코드가 있는지 확인해요",
  "insecure-network": "인터넷 통신 시 보안 검증을 건너뛰는 코드가 있는지 확인해요",
  "insecure-deserialization": "출처를 믿을 수 없는 데이터를 위험하게 불러오는지 확인해요",
  "data-exfiltration": "내 정보를 외부로 몰래 보낼 수 있는 코드가 있는지 확인해요",
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
  // 이 카테고리로 묶인 finding 개수. 기존에도 내부적으로 계산되던 값인데
  // 반환값에 포함되지 않고 버려지고 있었다 - 탐지 로직 변경 없이 노출만 추가한다.
  count: number;
};

export type PublicScanHeadline = {
  hasFindings: boolean;
  headline: string;
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
    .map(([categoryId, severity]) => {
      const types = typesByCategory.get(categoryId) ?? [];
      return {
        categoryId,
        severity,
        expertLabel: EXPERT_LABELS[categoryId],
        easyLabel: easyLabelFor(categoryId, types),
        count: types.length,
      };
    })
    .sort((a, b) => SEVERITIES.indexOf(a.severity) - SEVERITIES.indexOf(b.severity));
}

export type ScanChecklistItem = {
  categoryId: CategoryId;
  found: boolean;
  count: number;
  severity: Severity | null;
  expertLabel: string;
  easyLabel: string;
};

// 매물 상세/당사자 완성본 화면의 "검사 항목 보기" 체크리스트용 - 발견
// 여부와 무관하게 구매자 공개 5개 카테고리 전체를 CATEGORY_IDS 순서대로
// 나열한다. 발견된 카테고리는 groups(이미 findings에서 집계된 값)를 그대로
// 쓰고, 발견되지 않은 카테고리는 "이 카테고리가 무엇을 검사하는지"를
// 설명하는 중립 라벨(EXPERT_LABELS/CATEGORY_CHECK_DESCRIPTIONS)로 채운다 -
// findings를 다시 조회하거나 재계산하지 않는다(새 스캔 로직 아님).
export function buildScanChecklist(groups: PublicFindingGroup[]): ScanChecklistItem[] {
  const byId = new Map(groups.map((group) => [group.categoryId, group]));
  return CATEGORY_IDS.map((categoryId) => {
    const group = byId.get(categoryId);
    if (group) {
      return {
        categoryId,
        found: true,
        count: group.count,
        severity: group.severity,
        expertLabel: group.expertLabel,
        easyLabel: group.easyLabel,
      };
    }
    return {
      categoryId,
      found: false,
      count: 0,
      severity: null,
      expertLabel: EXPERT_LABELS[categoryId],
      easyLabel: CATEGORY_CHECK_DESCRIPTIONS[categoryId],
    };
  });
}

// groupFindingsForBuyer보다 한 단계 더 축약한 요약 - 완료된 의뢰를 공개로 볼 때
// (비로그인 포함) 카테고리/심각도조차 없이 통과 여부와 건수만 알린다. 개별
// finding 내용/파일 경로/증거는 groupFindingsForBuyer와 마찬가지로 절대
// 포함하지 않는다.
export function summarizeFindingsForPublicHeadline(findings: Finding[]): PublicScanHeadline {
  const groupCount = groupFindingsForBuyer(findings).length;
  if (groupCount === 0) {
    return { hasFindings: false, headline: "보안 검사 통과 · 확인된 문제 없음" };
  }
  return {
    hasFindings: true,
    headline: `확인된 항목 ${groupCount}건 · 제작자 설명 후 의뢰자가 수락`,
  };
}
