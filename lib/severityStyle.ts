import type { Severity } from "./types";

// 판매자 review 화면과 구매자 공개 요약 화면이 동일한 severity 배지 스타일을
// 쓰도록 공유한다.
export const SEVERITY_LABEL: Record<Severity, string> = {
  critical: "Critical",
  high: "High",
  medium: "Medium",
  low: "Low",
  informational: "Informational",
};

export const SEVERITY_ORDER: Severity[] = ["critical", "high", "medium", "low", "informational"];

export const SEVERITY_STYLE: Record<Severity, string> = {
  critical: "bg-red-50 text-red-700 dark:bg-red-950 dark:text-red-400",
  high: "bg-orange-50 text-orange-700 dark:bg-orange-950 dark:text-orange-400",
  medium: "bg-amber-50 text-amber-700 dark:bg-amber-950 dark:text-amber-400",
  low: "bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300",
  informational: "bg-zinc-100 text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400",
};
