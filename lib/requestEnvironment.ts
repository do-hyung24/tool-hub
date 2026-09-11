// 의뢰 등록 폼(NewRequestForm)과 서버 컴포넌트(edit/page.tsx)가 함께 쓰는
// "필요한 프로그램/환경" 칩 목록 + 문자열 파싱 로직. NewRequestForm.tsx는
// "use client"라서 거기서 export하면 서버 컴포넌트가 import할 때 클라이언트
// 참조가 되어 서버에서 실행할 수 없다 - 그래서 이 서버/클라 공용 모듈에 둔다.

export const ENVIRONMENT_CHIPS = [
  "엑셀/구글시트",
  "네이버 스마트스토어",
  "쿠팡",
  "카카오톡",
  "인스타그램",
  "유튜브",
  "이메일(Gmail/아웃룩)",
  "웹사이트 크롤링",
  "노션",
  "윈도우 PC 프로그램",
] as const;

// NewRequestForm의 buildRequiredEnvironment(칩/기타 텍스트 → 콤마로 합친 문자열)의
// 역변환 - 저장된 문자열을 수정 폼 프리필용으로 다시 칩 목록/기타 텍스트로 분리한다.
export function parseRequiredEnvironment(value: string): { chips: string[]; etcText: string } {
  if (!value) return { chips: [], etcText: "" };
  const parts = value
    .split(",")
    .map((part) => part.trim())
    .filter((part) => part !== "");
  const knownChips = new Set<string>(ENVIRONMENT_CHIPS);
  const chips = parts.filter((part) => knownChips.has(part));
  const etcParts = parts.filter((part) => !knownChips.has(part));
  return { chips, etcText: etcParts.join(", ") };
}
