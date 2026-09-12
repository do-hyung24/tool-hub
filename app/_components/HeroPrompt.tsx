"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

const MAX_LENGTH = 400;
const MAX_TEXTAREA_HEIGHT_PX = 72; // 대략 3줄
const COMPACT_TEXTAREA_HEIGHT_PX = 24; // 1줄 고정(넘침 방지)
const PLACEHOLDER =
  "어떤 업무를 자동화하고 싶으세요? 예: 매일 아침 스마트스토어 주문을 엑셀로 내려받아 재고 시트에 정리…";

// 이 컴포넌트는 폼 전송이나 DB 호출을 하지 않는다 - 입력한 문장을 쿼리
// 파라미터로 실어 /requests/new로 라우팅만 한다(실제 등록은 그 페이지에서).
export function HeroPrompt({ compact = false }: { compact?: boolean }) {
  const router = useRouter();
  const [value, setValue] = useState("");
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const maxHeightPx = compact ? COMPACT_TEXTAREA_HEIGHT_PX : MAX_TEXTAREA_HEIGHT_PX;

  function autoResize() {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, maxHeightPx)}px`;
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
    <div className={compact ? "mx-auto w-full max-w-3xl" : "mx-auto w-full max-w-xl"}>
      <div className="flex items-end gap-2 rounded-2xl bg-white/[0.04] p-2 pl-5 ring-1 ring-white/[0.10] transition-shadow focus-within:ring-2 focus-within:ring-white/[0.22]">
        <textarea
          ref={textareaRef}
          rows={compact ? 1 : 2}
          value={value}
          onChange={(event) => {
            setValue(event.target.value);
            autoResize();
          }}
          onKeyDown={handleKeyDown}
          maxLength={MAX_LENGTH}
          placeholder={PLACEHOLDER}
          className={`flex-1 resize-none bg-transparent py-2 text-sm text-offwhite outline-none placeholder:text-muted ${
            compact ? "max-h-6 overflow-hidden" : "max-h-[4.5rem] overflow-y-auto"
          }`}
        />
        <button
          type="button"
          onClick={submit}
          className="mb-1 shrink-0 rounded-xl bg-paper px-5 py-3 text-sm font-medium text-ink transition-colors hover:bg-zinc-200"
        >
          의뢰하기
        </button>
      </div>
      {!compact && (
        <div className="mt-3 flex flex-col items-center gap-1.5 text-center text-xs text-muted">
          <p className="break-keep">등록 무료 · 제안 전까지 비용 없음</p>
          <Link
            href="/requests"
            className="break-keep font-medium text-offwhite hover:opacity-80"
          >
            툴을 만들 수 있나요? 의뢰를 받아 수익화 →
          </Link>
        </div>
      )}
    </div>
  );
}
