import type { PublicFindingGroup } from "@/lib/findingCategories";
import { SecurityScanSummary } from "@/app/listings/[id]/SecurityScanSummary";

// 상세 페이지와 홈 히어로 예시가 공유하는 카드다. 스캔 결과와 무관하게 모든
// 매물에 예외 없이 노출되는 중립 고지 문구 + 요약 토글을 함께 묶는다.
export function ScanSummaryCard({
  groups,
  disclosureNote,
  className = "",
}: {
  groups: PublicFindingGroup[];
  disclosureNote?: string | null;
  className?: string;
}) {
  return (
    <section
      className={`rounded-xl border border-zinc-200 p-4 dark:border-transparent dark:bg-white/[0.03] dark:ring-1 dark:ring-white/[0.06] ${className}`}
    >
      <p className="flex items-center gap-1.5 text-sm font-medium text-zinc-700 dark:text-offwhite">
        <svg
          aria-hidden
          viewBox="0 0 20 20"
          fill="none"
          stroke="currentColor"
          strokeWidth={1.5}
          className="h-4 w-4 shrink-0"
        >
          <circle cx="9" cy="9" r="6" />
          <path strokeLinecap="round" d="M17.5 17.5l-4-4" />
        </svg>
        자동 보안 스캔을 거쳤습니다
      </p>
      {groups.length > 0 && <SecurityScanSummary groups={groups} />}
      {disclosureNote && (
        <div className="mt-3 border-t border-zinc-100 pt-3 dark:border-zinc-800">
          <h3 className="text-xs font-semibold text-zinc-500 dark:text-muted">
            판매자 코멘트
          </h3>
          <p className="mt-1 whitespace-pre-wrap text-sm text-zinc-700 dark:text-offwhite">
            {disclosureNote}
          </p>
        </div>
      )}
    </section>
  );
}
