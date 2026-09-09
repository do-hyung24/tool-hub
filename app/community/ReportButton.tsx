"use client";

import { useState } from "react";

export function ReportButton({
  apiPath,
  initiallyReported,
  isLoggedIn,
}: {
  apiPath: string;
  initiallyReported: boolean;
  isLoggedIn: boolean;
}) {
  const [reported, setReported] = useState(initiallyReported);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isLoggedIn) {
    return (
      <span className="text-xs text-zinc-300 dark:text-zinc-700">신고하려면 로그인이 필요합니다</span>
    );
  }

  if (reported) {
    return <span className="text-xs text-zinc-400 dark:text-zinc-500">신고 완료</span>;
  }

  async function handleReport() {
    setIsSubmitting(true);
    setError(null);
    try {
      const response = await fetch(apiPath, { method: "POST" });
      if (response.status === 409) {
        setReported(true);
        return;
      }
      const result = await response.json().catch(() => ({}));
      if (!response.ok) {
        setError(result.error ?? "신고에 실패했습니다.");
        return;
      }
      setReported(true);
    } catch {
      setError("신고 중 오류가 발생했습니다.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="flex items-center gap-2">
      <button
        type="button"
        onClick={handleReport}
        disabled={isSubmitting}
        className="text-xs text-zinc-400 hover:underline disabled:cursor-not-allowed disabled:opacity-50 dark:text-zinc-500"
      >
        신고
      </button>
      {error && <span className="text-xs text-red-600 dark:text-red-400">{error}</span>}
    </div>
  );
}
