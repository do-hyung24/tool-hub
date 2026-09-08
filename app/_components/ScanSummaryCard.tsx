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
      className={`rounded-xl border border-zinc-200 p-4 dark:border-zinc-800 ${className}`}
    >
      <p className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
        🔍 자동 보안 스캔을 거쳤습니다
      </p>
      {groups.length > 0 && <SecurityScanSummary groups={groups} />}
      {disclosureNote && (
        <div className="mt-3 border-t border-zinc-100 pt-3 dark:border-zinc-800">
          <h3 className="text-xs font-semibold text-zinc-500 dark:text-zinc-400">
            판매자 코멘트
          </h3>
          <p className="mt-1 whitespace-pre-wrap text-sm text-zinc-700 dark:text-zinc-300">
            {disclosureNote}
          </p>
        </div>
      )}
    </section>
  );
}
