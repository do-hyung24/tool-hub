"use client";

import { useState } from "react";

type Step = { title: string; body: string };

const REQUESTER_STEPS: Step[] = [
  {
    title: "필요한 일을 설명해요",
    body: "지금 하는 일과 원하는 결과물을 글과 사진으로 남겨주세요.",
  },
  {
    title: "제안을 비교해요",
    body: "여러 제작자의 가격과 기간을 비교하고 하나를 선택해요.",
  },
  {
    title: "검사된 완성본을 받아요",
    body: "완성본은 자동 보안 스캔을 거친 뒤 전달돼요.",
  },
];

const MAKER_STEPS: Step[] = [
  {
    title: "의뢰를 둘러봐요",
    body: "필요한 자동화를 찾는 의뢰들을 확인해요.",
  },
  {
    title: "가격과 기간을 제안해요",
    body: "할 수 있는 가격과 기간으로 제안을 남겨요.",
  },
  {
    title: "완성본을 제출해요",
    body: "완성본은 제출과 동시에 자동으로 보안 스캔을 받아요.",
  },
];

export function HowItWorksTabs() {
  const [tab, setTab] = useState<"requester" | "maker">("requester");
  const steps = tab === "requester" ? REQUESTER_STEPS : MAKER_STEPS;

  return (
    <div>
      <div className="inline-flex rounded-full border border-zinc-950/[0.08] p-0.5 text-sm">
        <TabButton label="의뢰자" active={tab === "requester"} onClick={() => setTab("requester")} />
        <TabButton label="제작자" active={tab === "maker"} onClick={() => setTab("maker")} />
      </div>

      <div className="mt-8 flex flex-col gap-6">
        {steps.map((step, index) => (
          <div key={step.title} className="flex flex-col gap-2">
            <span className="font-mono text-sm font-semibold text-zinc-400">
              {String(index + 1).padStart(2, "0")}
            </span>
            <h3 className="text-lg font-semibold tracking-[-0.01em] text-zinc-900">{step.title}</h3>
            <p className="text-[15px] leading-[1.7] text-zinc-600 lg:text-base">{step.body}</p>
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
