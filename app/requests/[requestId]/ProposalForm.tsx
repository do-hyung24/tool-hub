"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

const DESCRIPTION_MAX_LENGTH = 2000;

// NewRequestForm의 예산 필드와 동일한 방식: state는 콤마 없는 숫자 문자열만
// 들고, 화면 표시만 천단위 콤마를 붙인다.
function formatPriceDisplay(rawDigits: string): string {
  if (!rawDigits) return "";
  return Number(rawDigits).toLocaleString("ko-KR");
}

export function ProposalForm({ requestId }: { requestId: string }) {
  const router = useRouter();
  const [price, setPrice] = useState("");
  const [duration, setDuration] = useState("");
  const [description, setDescription] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    setIsSubmitting(true);
    try {
      const response = await fetch(`/api/requests/${requestId}/proposals`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ price: Number(price), duration, description }),
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) {
        setError(result.error ?? "제안 등록에 실패했습니다.");
        return;
      }
      setPrice("");
      setDuration("");
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
      <div className="flex gap-2">
        <input
          required
          type="text"
          inputMode="numeric"
          value={formatPriceDisplay(price)}
          onChange={(event) => setPrice(event.target.value.replace(/[^0-9]/g, ""))}
          placeholder="가격 (원)"
          className="w-1/2 rounded-lg border border-zinc-300 px-3 py-2 text-sm outline-none focus:border-zinc-500 dark:border-zinc-700 dark:bg-zinc-900"
        />
        <input
          required
          type="text"
          value={duration}
          onChange={(event) => setDuration(event.target.value)}
          placeholder="작업 기간 (예: 3일)"
          className="w-1/2 rounded-lg border border-zinc-300 px-3 py-2 text-sm outline-none focus:border-zinc-500 dark:border-zinc-700 dark:bg-zinc-900"
        />
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
        disabled={isSubmitting || !price.trim() || !duration.trim() || !description.trim()}
        className="w-fit rounded-full bg-zinc-900 px-4 py-1.5 text-sm font-medium text-white transition-colors hover:bg-zinc-700 disabled:cursor-not-allowed disabled:opacity-40 dark:bg-zinc-50 dark:text-zinc-900 dark:hover:bg-zinc-200"
      >
        {isSubmitting ? "등록 중..." : "제안 등록"}
      </button>
    </form>
  );
}
