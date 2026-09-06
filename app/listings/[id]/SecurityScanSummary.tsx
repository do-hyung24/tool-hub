"use client";

import { useState } from "react";
import type { PublicFindingGroup } from "@/lib/findingCategories";
import { SEVERITY_LABEL, SEVERITY_STYLE } from "@/lib/severityStyle";

type ViewMode = "easy" | "expert";

export function SecurityScanSummary({ groups }: { groups: PublicFindingGroup[] }) {
  const [mode, setMode] = useState<ViewMode>("easy");

  return (
    <div className="mt-3 border-t border-zinc-100 pt-3 dark:border-zinc-800">
      <div className="flex items-center justify-between gap-3">
        <h3 className="text-xs font-semibold text-zinc-500 dark:text-zinc-400">
          발견된 항목 ({groups.length}건)
        </h3>
        <div className="inline-flex shrink-0 rounded-full border border-zinc-200 p-0.5 text-xs dark:border-zinc-700">
          <button
            type="button"
            onClick={() => setMode("easy")}
            aria-pressed={mode === "easy"}
            className={`rounded-full px-2.5 py-1 font-medium transition-colors ${
              mode === "easy"
                ? "bg-zinc-900 text-white dark:bg-zinc-50 dark:text-zinc-900"
                : "text-zinc-500 hover:text-zinc-700 dark:text-zinc-400 dark:hover:text-zinc-200"
            }`}
          >
            쉬운 보기
          </button>
          <button
            type="button"
            onClick={() => setMode("expert")}
            aria-pressed={mode === "expert"}
            className={`rounded-full px-2.5 py-1 font-medium transition-colors ${
              mode === "expert"
                ? "bg-zinc-900 text-white dark:bg-zinc-50 dark:text-zinc-900"
                : "text-zinc-500 hover:text-zinc-700 dark:text-zinc-400 dark:hover:text-zinc-200"
            }`}
          >
            전문가용 보기
          </button>
        </div>
      </div>

      <ul className="mt-3 flex flex-col gap-2">
        {groups.map((group) => (
          <li
            key={group.categoryId}
            className="flex items-start gap-2.5 rounded-lg bg-zinc-50 p-2.5 text-sm dark:bg-zinc-900/60"
          >
            <span
              className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-semibold ${SEVERITY_STYLE[group.severity]}`}
            >
              {SEVERITY_LABEL[group.severity]}
            </span>
            <span className="text-zinc-700 dark:text-zinc-300">
              {mode === "easy" ? group.easyLabel : group.expertLabel}
            </span>
          </li>
        ))}
      </ul>

      <p className="mt-3 text-xs text-zinc-400 dark:text-zinc-500">
        자세한 위치와 코드 내용은 판매자만 확인할 수 있습니다. 판매자 코멘트를 함께 참고해주세요.
      </p>
    </div>
  );
}
