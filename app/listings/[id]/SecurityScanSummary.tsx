"use client";

import { useState } from "react";
import { buildScanChecklist, type PublicFindingGroup } from "@/lib/findingCategories";
import { SEVERITY_LABEL, SEVERITY_STYLE } from "@/lib/severityStyle";

type ViewMode = "easy" | "expert";

// groups가 빈 배열이어도(스캔은 했지만 발견 0건) 렌더링된다 - 호출부
// (ScanSummaryCard)는 스캔 리포트 자체가 없을 때(null)만 이 컴포넌트를
// 아예 렌더링하지 않는다.
export function SecurityScanSummary({ groups }: { groups: PublicFindingGroup[] }) {
  const [mode, setMode] = useState<ViewMode>("easy");
  const checklist = buildScanChecklist(groups);
  const flaggedCount = groups.length;

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
            상세 보기
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
              {mode === "easy" ? (
                group.easyLabel
              ) : (
                <>
                  {group.expertLabel}
                  {/* 상세 보기에서도 전문용어를 지우지 않고, 비개발자용 한 줄 설명을
                      함께 보여준다(용어 자체는 그대로 유지). */}
                  <span className="mt-0.5 block text-xs text-zinc-500 dark:text-zinc-400">
                    {group.easyLabel}
                  </span>
                </>
              )}
            </span>
          </li>
        ))}
      </ul>

      {/* 검사한 카테고리 전체 목록 - JS 없이도 접기/펼치기가 동작해야 해서
          useState 대신 네이티브 <details>를 쓴다. 기본은 접힌 상태다. */}
      <details className="mt-3">
        <summary className="cursor-pointer text-xs font-medium text-zinc-500 underline underline-offset-2 hover:text-zinc-700 dark:text-zinc-400 dark:hover:text-zinc-200">
          검사 항목 보기
        </summary>
        <div className="mt-2 rounded-lg bg-zinc-50 p-3 dark:bg-zinc-900/60">
          <p className="text-xs font-medium text-zinc-600 dark:text-zinc-300">
            {flaggedCount > 0 ? `확인 필요 ${flaggedCount}건` : "발견된 항목 없음"}
          </p>
          <ul className="mt-2 flex flex-col gap-1.5">
            {checklist.map((item) => (
              <li
                key={item.categoryId}
                className="flex items-center justify-between gap-3 text-xs text-zinc-700 dark:text-zinc-300"
              >
                <span>{mode === "easy" ? item.easyLabel : item.expertLabel}</span>
                <span className="shrink-0 text-zinc-500 dark:text-zinc-400">
                  {item.found ? `${item.count}건` : "해당 없음"}
                </span>
              </li>
            ))}
          </ul>
        </div>
      </details>

      <p className="mt-3 text-xs text-zinc-400 dark:text-zinc-500">
        자세한 위치와 코드 내용은 판매자만 확인할 수 있습니다. 판매자 코멘트를 함께 참고해주세요.
      </p>
    </div>
  );
}
