"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function DeleteRequestButton({ requestId }: { requestId: string }) {
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleDelete() {
    if (!window.confirm("정말 이 의뢰를 삭제하시겠습니까? 되돌릴 수 없습니다.")) {
      return;
    }
    setError(null);
    setIsSubmitting(true);
    try {
      const response = await fetch(`/api/requests/${requestId}`, { method: "DELETE" });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) {
        setError(result.error ?? "삭제에 실패했습니다.");
        return;
      }
      router.push("/requests");
    } catch {
      setError("삭제 중 오류가 발생했습니다.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="flex items-center gap-2">
      <button
        type="button"
        onClick={handleDelete}
        disabled={isSubmitting}
        className="rounded-full border border-red-300 px-3 py-1 text-xs font-medium text-red-600 transition-colors hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-40 dark:border-red-800 dark:text-red-400 dark:hover:bg-red-950"
      >
        {isSubmitting ? "삭제 중..." : "삭제"}
      </button>
      {error && <span className="text-xs text-red-600 dark:text-red-400">{error}</span>}
    </div>
  );
}
