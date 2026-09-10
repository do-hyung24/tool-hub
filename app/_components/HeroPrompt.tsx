"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

const MAX_LENGTH = 400;
const MAX_TEXTAREA_HEIGHT_PX = 72; // 대략 3줄

// 이 컴포넌트는 폼 전송이나 DB 호출을 하지 않는다 - 입력한 문장을 쿼리
// 파라미터로 실어 /requests/new로 라우팅만 한다(실제 등록은 그 페이지에서).
export function HeroPrompt({ compact = false }: { compact?: boolean }) {
  const router = useRouter();
  const [value, setValue] = useState("");
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  function autoResize() {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, MAX_TEXTAREA_HEIGHT_PX)}px`;
  }

  function submit() {
    const trimmed = value.trim().slice(0, MAX_LENGTH);
    router.push(trimmed ? `/requests/new?desc=${encodeURIComponent(trimmed)}` : "/requests/new");
  }

  function handleKeyDown(event: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      submit();
    }
  }

  return (
    <div className={compact ? "mx-auto w-full max-w-xl" : "mx-auto w-full max-w-2xl"}>
      <div className="flex items-end gap-2 rounded-2xl border border-zinc-800 bg-zinc-900 p-3 ring-1 ring-white/10 transition-shadow focus-within:ring-2 focus-within:ring-emerald-500/40">
        <svg
          aria-hidden
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth={1.5}
          className="mt-2 h-5 w-5 shrink-0 text-zinc-500"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931zm0 0L19.5 7.125"
          />
        </svg>
        <textarea
          ref={textareaRef}
          rows={1}
          value={value}
          onChange={(event) => {
            setValue(event.target.value);
            autoResize();
          }}
          onKeyDown={handleKeyDown}
          maxLength={MAX_LENGTH}
          placeholder="예: 매일 아침 스마트스토어 주문을 엑셀로 정리하는 일을 자동화하고 싶어요"
          className="max-h-[4.5rem] flex-1 resize-none overflow-y-auto bg-transparent py-2 text-sm text-zinc-100 outline-none placeholder:text-zinc-500"
        />
        <button
          type="button"
          onClick={submit}
          className="mb-1 shrink-0 rounded-full bg-emerald-400 px-4 py-2 text-sm font-medium text-black transition-colors hover:bg-emerald-300"
        >
          의뢰 시작하기
        </button>
      </div>
      {!compact && (
        <p className="mt-3 text-center text-xs text-zinc-500">
          등록 무료 · 제안을 받기 전까지 비용 없음 · 제작자로 참여하려면{" "}
          <Link href="/requests" className="underline hover:text-zinc-300">
            의뢰 둘러보기
          </Link>
        </p>
      )}
    </div>
  );
}
