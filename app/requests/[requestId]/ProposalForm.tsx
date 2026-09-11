"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { getKstTodayDateString } from "@/lib/dday";
import { DDayBadge } from "@/app/_components/DDayBadge";

const DESCRIPTION_MAX_LENGTH = 2000;

// NewRequestForm의 예산 필드와 동일한 방식: state는 콤마 없는 숫자 문자열만
// 들고, 화면 표시만 천단위 콤마를 붙인다.
function formatPriceDisplay(rawDigits: string): string {
  if (!rawDigits) return "";
  return Number(rawDigits).toLocaleString("ko-KR");
}

// 등록 폼(app/requests/new/NewRequestForm.tsx)과 동일한 KST 기준 오늘/+6개월 계산.
function getKstDateString(offsetMonths = 0): string {
  const kstNow = new Date(Date.now() + 9 * 60 * 60 * 1000);
  kstNow.setUTCMonth(kstNow.getUTCMonth() + offsetMonths);
  return kstNow.toISOString().slice(0, 10);
}

export function ProposalForm({ requestId }: { requestId: string }) {
  const router = useRouter();
  const [price, setPrice] = useState("");
  const [proposedCompletionDate, setProposedCompletionDate] = useState("");
  const [description, setDescription] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [minDate] = useState(() => getKstDateString(0));
  const [maxDate] = useState(() => getKstDateString(6));
  const today = getKstTodayDateString();

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    setIsSubmitting(true);
    try {
      const response = await fetch(`/api/requests/${requestId}/proposals`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ price: Number(price), proposedCompletionDate, description }),
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) {
        setError(result.error ?? "제안 등록에 실패했습니다.");
        return;
      }
      setPrice("");
      setProposedCompletionDate("");
      setDescription("");
      router.refresh();
    } catch {
      setError("제안 등록 중 오류가 발생했습니다.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="mt-4 flex flex-col gap-2">
      <div className="flex items-start gap-2">
        <div className="flex w-1/2 flex-col gap-1">
          <span className="text-xs text-zinc-400 dark:text-zinc-500">가격</span>
          <div className="relative">
            <input
              required
              type="text"
              inputMode="numeric"
              value={formatPriceDisplay(price)}
              onChange={(event) => setPrice(event.target.value.replace(/[^0-9]/g, ""))}
              placeholder="예: 100,000"
              className="w-full rounded-lg border border-zinc-300 py-2 pl-3 pr-8 text-sm outline-none focus:border-zinc-500 dark:border-zinc-700 dark:bg-zinc-900"
            />
            <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-sm text-zinc-400 dark:text-zinc-500">
              원
            </span>
          </div>
        </div>
        <div className="flex w-1/2 flex-col gap-1">
          <span className="text-xs text-zinc-400 dark:text-zinc-500">완료 예정일</span>
          <div className="flex items-center gap-2">
            <input
              required
              type="date"
              min={minDate}
              max={maxDate}
              value={proposedCompletionDate}
              onChange={(event) => setProposedCompletionDate(event.target.value)}
              className={`flex-1 rounded-lg border border-zinc-300 px-3 py-2 text-sm outline-none focus:border-zinc-500 dark:border-zinc-700 dark:bg-zinc-900 ${
                proposedCompletionDate === ""
                  ? "[&::-webkit-datetime-edit]:text-zinc-400 dark:[&::-webkit-datetime-edit]:text-zinc-500"
                  : "[&::-webkit-datetime-edit]:text-zinc-900 dark:[&::-webkit-datetime-edit]:text-zinc-50"
              }`}
            />
            {proposedCompletionDate && <DDayBadge today={today} deadline={proposedCompletionDate} />}
          </div>
        </div>
      </div>
      <textarea
        required
        rows={4}
        maxLength={DESCRIPTION_MAX_LENGTH}
        value={description}
        onChange={(event) => setDescription(event.target.value)}
        placeholder="제안 내용을 입력해주세요."
        className="resize-none rounded-lg border border-zinc-300 px-3 py-2 text-sm outline-none focus:border-zinc-500 dark:border-zinc-700 dark:bg-zinc-900"
      />
      {error && <p className="text-xs font-medium text-red-600 dark:text-red-400">{error}</p>}
      <button
        type="submit"
        disabled={isSubmitting || !price.trim() || !proposedCompletionDate || !description.trim()}
        className="w-fit rounded-full bg-zinc-900 px-4 py-1.5 text-sm font-medium text-white transition-colors hover:bg-zinc-700 disabled:cursor-not-allowed disabled:opacity-40 dark:bg-zinc-50 dark:text-zinc-900 dark:hover:bg-zinc-200"
      >
        {isSubmitting ? "등록 중..." : "제안 등록"}
      </button>
    </form>
  );
}
