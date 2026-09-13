"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { saveLandingDraft } from "@/lib/landingDraft";

const KEYWORD_PLACEHOLDER = "어떤 일로 시간을 빼앗기고 계신가요? 단어나 한 줄만 적으셔도 괜찮습니다.";
const KEYWORD_MAX_LENGTH = 200;
const ANSWER_MAX_LENGTH = 200;

type Stage = "collapsed" | "expanded";

function prefersReducedMotion(): boolean {
  if (typeof window === "undefined") return false;
  try {
    return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  } catch {
    return false;
  }
}

// 랜딩에서 받은 키워드+3개 답변을 의뢰 등록 폼의 실제 필드(title/description)로
// 조립한다. 새 필드를 만들지 않고 기존 두 필드에만 매핑한다.
function buildDescription(keyword: string, q1: string, q2: string, q3: string): string {
  const lines = [keyword.trim()];
  if (q1.trim()) lines.push(`사용 중인 프로그램/사이트: ${q1.trim()}`);
  if (q2.trim()) lines.push(`반복되는 방식과 주기: ${q2.trim()}`);
  if (q3.trim()) lines.push(`원하는 최종 결과물: ${q3.trim()}`);
  return lines.join("\n");
}

// 이 컴포넌트는 폼 전송이나 DB 호출을 하지 않는다 - 조립한 제목/설명을 로그인
// 상태면 쿼리 파라미터로, 비로그인이면 로컬 저장소에 실어 /requests/new
// (또는 로그인 화면)로 라우팅만 한다(실제 등록은 그 페이지에서).
export function HeroPrompt({
  compact = false,
  isLoggedIn,
}: {
  compact?: boolean;
  isLoggedIn: boolean;
}) {
  const router = useRouter();
  const [stage, setStage] = useState<Stage>("collapsed");
  const [keyword, setKeyword] = useState("");
  const [q1, setQ1] = useState("");
  const [q2, setQ2] = useState("");
  const [q3, setQ3] = useState("");
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (stage !== "expanded") return;
    const id = requestAnimationFrame(() => {
      containerRef.current?.scrollIntoView({
        block: "nearest",
        behavior: prefersReducedMotion() ? "auto" : "smooth",
      });
    });
    return () => cancelAnimationFrame(id);
  }, [stage]);

  function expand() {
    if (!keyword.trim()) return;
    setStage("expanded");
  }

  function handleKeywordKeyDown(event: React.KeyboardEvent<HTMLInputElement>) {
    if (event.key === "Enter") {
      event.preventDefault();
      expand();
    }
  }

  function handleSubmit() {
    const trimmedKeyword = keyword.trim();
    if (!trimmedKeyword) return;

    const title = trimmedKeyword.slice(0, KEYWORD_MAX_LENGTH);
    const description = buildDescription(trimmedKeyword, q1, q2, q3);

    if (isLoggedIn) {
      const params = new URLSearchParams();
      params.set("title", title);
      params.set("desc", description);
      router.push(`/requests/new?${params.toString()}`);
      return;
    }

    saveLandingDraft({ title, description });
    router.push(`/login?next=${encodeURIComponent("/requests/new")}`);
  }

  return (
    <div ref={containerRef} className={compact ? "mx-auto w-full max-w-3xl" : "mx-auto w-full max-w-xl"}>
      {stage === "collapsed" ? (
        <div className="flex items-end gap-2 rounded-2xl bg-white/[0.04] p-2 pl-5 ring-1 ring-white/[0.10] transition-shadow focus-within:ring-2 focus-within:ring-white/[0.22]">
          <input
            type="text"
            value={keyword}
            onChange={(event) => setKeyword(event.target.value)}
            onKeyDown={handleKeywordKeyDown}
            maxLength={KEYWORD_MAX_LENGTH}
            placeholder={KEYWORD_PLACEHOLDER}
            className="flex-1 bg-transparent py-2 text-sm text-offwhite outline-none placeholder:text-muted"
          />
          <button
            type="button"
            onClick={expand}
            disabled={!keyword.trim()}
            className="mb-1 shrink-0 rounded-xl bg-paper px-5 py-3 text-sm font-medium text-ink transition-colors hover:bg-zinc-200 disabled:cursor-not-allowed disabled:opacity-40"
          >
            의뢰하기 ↵
          </button>
        </div>
      ) : (
        <div className="flex items-center">
          <button
            type="button"
            onClick={() => setStage("collapsed")}
            aria-label="키워드 수정하기"
            className="flex items-center gap-2 rounded-full bg-white/[0.08] px-4 py-2 text-sm font-medium text-offwhite ring-1 ring-white/[0.14] hover:bg-white/[0.12]"
          >
            {keyword.trim()}
            <span aria-hidden className="text-muted">
              ✎
            </span>
          </button>
        </div>
      )}

      {stage === "collapsed" && (
        <p className="mt-2 break-keep text-xs text-muted">
          예: 스마트스토어 주문 정리 · 엑셀 취합 · 인스타 댓글 수집
        </p>
      )}

      <div
        className={`grid transition-[grid-template-rows] duration-300 ease-in-out motion-reduce:transition-none motion-reduce:duration-0 ${
          stage === "expanded" ? "mt-4 grid-rows-[1fr]" : "grid-rows-[0fr]"
        }`}
      >
        <div className="overflow-hidden">
          <div className="flex flex-col gap-3 rounded-2xl bg-white/[0.04] p-4 ring-1 ring-white/[0.10]">
            <div className="flex flex-col gap-1.5 text-left">
              <label htmlFor="hero-q1" className="text-xs font-medium text-muted">
                사용 중인 프로그램/사이트
              </label>
              <input
                id="hero-q1"
                type="text"
                value={q1}
                onChange={(event) => setQ1(event.target.value)}
                maxLength={ANSWER_MAX_LENGTH}
                placeholder="예: 스마트스토어, 엑셀, 카카오톡"
                className="rounded-lg bg-white/[0.06] px-3 py-2 text-sm text-offwhite outline-none ring-1 ring-white/[0.10] placeholder:text-muted focus:ring-white/[0.22]"
              />
            </div>
            <div className="flex flex-col gap-1.5 text-left">
              <label htmlFor="hero-q2" className="text-xs font-medium text-muted">
                반복되는 방식과 주기
              </label>
              <input
                id="hero-q2"
                type="text"
                value={q2}
                onChange={(event) => setQ2(event.target.value)}
                maxLength={ANSWER_MAX_LENGTH}
                placeholder="예: 매일 아침 9시마다 내려받아 옮겨 적기"
                className="rounded-lg bg-white/[0.06] px-3 py-2 text-sm text-offwhite outline-none ring-1 ring-white/[0.10] placeholder:text-muted focus:ring-white/[0.22]"
              />
            </div>
            <div className="flex flex-col gap-1.5 text-left">
              <label htmlFor="hero-q3" className="text-xs font-medium text-muted">
                원하는 최종 결과물
              </label>
              <input
                id="hero-q3"
                type="text"
                value={q3}
                onChange={(event) => setQ3(event.target.value)}
                maxLength={ANSWER_MAX_LENGTH}
                placeholder="예: 하나로 합쳐진 엑셀 파일 / 슬랙·알림톡 메시지"
                className="rounded-lg bg-white/[0.06] px-3 py-2 text-sm text-offwhite outline-none ring-1 ring-white/[0.10] placeholder:text-muted focus:ring-white/[0.22]"
              />
            </div>

            <p className="break-keep text-pretty text-xs text-muted">
              잘 모르겠거나 애매한 부분은 빈칸으로 두셔도 괜찮습니다. 제작자가 제안할 때 세부
              내용을 맞춰드립니다.
            </p>

            <button
              type="button"
              onClick={handleSubmit}
              className="w-fit rounded-xl bg-paper px-5 py-3 text-sm font-medium text-ink transition-colors hover:bg-zinc-200"
            >
              이 내용으로 의뢰 등록하기 (무료) →
            </button>
          </div>
        </div>
      </div>

      {!compact && stage === "collapsed" && (
        <div className="mt-3 flex flex-col items-center gap-1.5 text-center text-xs text-muted">
          <p className="break-keep">등록 무료 · 제안 전까지 비용 없음</p>
          <Link
            href="/requests?status=open"
            className="break-keep font-medium text-offwhite hover:opacity-80"
          >
            툴을 만들 수 있나요? 의뢰를 받아 수익화 →
          </Link>
        </div>
      )}
    </div>
  );
}
