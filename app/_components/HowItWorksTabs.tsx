"use client";

import { useState } from "react";

type Step = { icon: string; title: string; body: string };

const SELLER_STEPS: Step[] = [
  { icon: "📦", title: "코드 등록", body: "zip 파일 업로드나 GitHub 저장소 링크로 등록해요." },
  { icon: "🔍", title: "자동 스캔 대기", body: "시크릿 노출, 위험한 코드 실행 등을 자동으로 확인해요." },
  { icon: "📋", title: "결과 확인 후 게시", body: "리포트를 확인하고 그대로 게시하거나, 코드를 고쳐 다시 스캔해요." },
];

const BUYER_STEPS: Step[] = [
  { icon: "🔎", title: "매물 둘러보기", body: "카테고리로 필터링해 원하는 자동화 툴을 찾아요." },
  { icon: "🔍", title: "스캔 요약 확인", body: "구매 전에 발견된 위험 카테고리와 심각도를 투명하게 확인해요." },
  { icon: "💬", title: "판매자에게 연락", body: "공개된 연락처로 직접 연결해 거래를 진행해요." },
];

export function HowItWorksTabs() {
  const [tab, setTab] = useState<"seller" | "buyer">("seller");
  const steps = tab === "seller" ? SELLER_STEPS : BUYER_STEPS;

  return (
    <div>
      <div className="inline-flex rounded-full border border-zinc-200 p-0.5 text-sm dark:border-zinc-800">
        <TabButton label="판매자 가이드" active={tab === "seller"} onClick={() => setTab("seller")} />
        <TabButton label="구매자 가이드" active={tab === "buyer"} onClick={() => setTab("buyer")} />
      </div>

      <div className="mt-8 grid grid-cols-1 gap-6 sm:grid-cols-3">
        {steps.map((step, index) => (
          <div key={step.title} className="flex flex-col gap-2">
            <div className="flex items-center gap-2">
              <span className="text-2xl" aria-hidden>
                {step.icon}
              </span>
              <span className="text-xs font-medium text-zinc-400 dark:text-zinc-500">
                {index + 1}단계
              </span>
            </div>
            <h3 className="font-semibold text-zinc-900 dark:text-zinc-50">{step.title}</h3>
            <p className="text-sm text-zinc-500 dark:text-zinc-400">{step.body}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

function TabButton({
  label,
  active,
  onClick,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={`rounded-full px-4 py-1.5 font-medium transition-colors ${
        active
          ? "bg-zinc-900 text-white dark:bg-zinc-50 dark:text-zinc-900"
          : "text-zinc-500 hover:text-zinc-700 dark:text-zinc-400 dark:hover:text-zinc-200"
      }`}
    >
      {label}
    </button>
  );
}
