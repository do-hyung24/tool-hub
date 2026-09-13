// D-day 계산/포맷 공용 헬퍼. app/my/page.tsx, app/requests/[requestId]/ProposalForm.tsx,
// app/requests/[requestId]/page.tsx가 모두 이 함수들을 재사용해 같은 기준으로
// D-day를 계산·표시한다(중복 구현 금지).

export const DATE_ONLY_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

// 등록 폼(app/requests/new/NewRequestForm.tsx)과 동일한 방식으로 KST 오늘 날짜를 구한다.
export function getKstTodayDateString(): string {
  return new Date(Date.now() + 9 * 60 * 60 * 1000).toISOString().slice(0, 10);
}

export function daysBetween(fromDateStr: string, toDateStr: string): number {
  const from = new Date(`${fromDateStr}T00:00:00Z`).getTime();
  const to = new Date(`${toDateStr}T00:00:00Z`).getTime();
  return Math.round((to - from) / (24 * 60 * 60 * 1000));
}

export function formatDDay(diff: number): string {
  return diff > 0 ? `D-${diff}` : diff === 0 ? "D-DAY" : `D+${Math.abs(diff)}`;
}

export function getDDayColorClass(diff: number): string {
  return diff < 0
    ? "bg-red-50 text-red-700 dark:bg-red-950 dark:text-red-400"
    : diff <= 3
    ? "bg-amber-50 text-amber-700 dark:bg-amber-950 dark:text-amber-400"
    : "bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300";
}
