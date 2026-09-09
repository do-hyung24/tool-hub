"use client";

import { useEffect, useState } from "react";
import { resendVerificationAction } from "@/app/authActions";

function formatRemaining(ms: number): string {
  const totalSeconds = Math.ceil(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${String(seconds).padStart(2, "0")}`;
}

export function ResendButton({
  initialRetryAt,
  label,
}: {
  initialRetryAt: number | null;
  label: string;
}) {
  const [remainingMs, setRemainingMs] = useState(
    initialRetryAt ? Math.max(0, initialRetryAt - Date.now()) : 0
  );

  useEffect(() => {
    if (remainingMs <= 0) return;
    const interval = setInterval(() => {
      setRemainingMs((prev) => Math.max(0, prev - 1000));
    }, 1000);
    return () => clearInterval(interval);
  }, [remainingMs]);

  const disabled = remainingMs > 0;

  return (
    <form action={resendVerificationAction} className="mt-4 flex items-center gap-3">
      <button
        type="submit"
        disabled={disabled}
        className="rounded-full border border-zinc-300 px-5 py-2.5 text-sm font-medium text-zinc-700 transition-colors hover:bg-zinc-100 disabled:cursor-not-allowed disabled:opacity-40 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
      >
        {label}
      </button>
      {disabled && (
        <span className="text-xs text-zinc-500 dark:text-zinc-400">
          {formatRemaining(remainingMs)} 후 재발송 가능
        </span>
      )}
    </form>
  );
}
