import type { ScanResult } from "@/lib/types";

export function ScanBadge({ scanResult }: { scanResult: ScanResult | null }) {
  if (!scanResult) {
    return (
      <span className="inline-flex animate-pulse items-center gap-1 rounded-full bg-zinc-100 px-2.5 py-1 text-xs font-medium text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400">
        ⏳ 스캔 중
      </span>
    );
  }

  if (scanResult.passed) {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-medium text-emerald-700 dark:bg-emerald-950 dark:text-emerald-400">
        ✓ 보안 스캔 완료
      </span>
    );
  }

  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2.5 py-1 text-xs font-medium text-amber-700 dark:bg-amber-950 dark:text-amber-400">
      ⚠ 개선 필요
    </span>
  );
}
