"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function SelectProposalButton({
  requestId,
  proposalId,
}: {
  requestId: string;
  proposalId: string;
}) {
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSelect() {
    setError(null);
    setIsSubmitting(true);
    try {
      const response = await fetch(
        `/api/requests/${requestId}/proposals/${proposalId}/select`,
        { method: "POST" }
      );
      const result = await response.json().catch(() => ({}));
      if (!response.ok) {
        setError(result.error ?? "제안 선택에 실패했습니다.");
        return;
      }
      router.refresh();
    } catch {
      setError("제안 선택 중 오류가 발생했습니다.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="flex items-center gap-2">
      <button
        type="button"
        onClick={handleSelect}
        disabled={isSubmitting}
        className="w-fit rounded-full bg-zinc-900 px-3 py-1 text-xs font-medium text-white transition-colors hover:bg-zinc-700 disabled:cursor-not-allowed disabled:opacity-40 dark:bg-zinc-50 dark:text-zinc-900 dark:hover:bg-zinc-200"
      >
        {isSubmitting ? "처리 중..." : "이 제안 선택하기"}
      </button>
      {error && <span className="text-xs text-red-600 dark:text-red-400">{error}</span>}
    </div>
  );
}
