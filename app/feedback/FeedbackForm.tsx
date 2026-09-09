"use client";

import { useState } from "react";
import { FEEDBACK_CATEGORIES, type FeedbackCategory } from "@/lib/types";

const MESSAGE_MIN_LENGTH = 5;
const MESSAGE_MAX_LENGTH = 2000;

export function FeedbackForm() {
  const [category, setCategory] = useState<FeedbackCategory>(FEEDBACK_CATEGORIES[0]);
  const [message, setMessage] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState(false);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    setIsSubmitting(true);
    try {
      const response = await fetch("/api/feedback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ category, message }),
      });
      const result = await response.json();
      if (!response.ok) {
        setError(result.error ?? "제출에 실패했습니다.");
        return;
      }
      setSubmitted(true);
    } catch {
      setError("제출 중 오류가 발생했습니다. 다시 시도해주세요.");
    } finally {
      setIsSubmitting(false);
    }
  }

  if (submitted) {
    return (
      <p className="mt-8 text-sm font-medium text-emerald-600 dark:text-emerald-400">
        소중한 의견 감사합니다. 검토 후 반영하겠습니다.
      </p>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="mt-8 flex flex-col gap-6">
      <div className="flex flex-col gap-1.5">
        <label htmlFor="category" className="text-sm font-medium">
          카테고리
        </label>
        <select
          id="category"
          value={category}
          onChange={(event) => setCategory(event.target.value as FeedbackCategory)}
          className="rounded-lg border border-zinc-300 px-3 py-2 text-sm outline-none focus:border-zinc-500 dark:border-zinc-700 dark:bg-zinc-900"
        >
          {FEEDBACK_CATEGORIES.map((value) => (
            <option key={value} value={value}>
              {value}
            </option>
          ))}
        </select>
      </div>

      <div className="flex flex-col gap-1.5">
        <label htmlFor="message" className="text-sm font-medium">
          내용
        </label>
        <textarea
          id="message"
          required
          minLength={MESSAGE_MIN_LENGTH}
          maxLength={MESSAGE_MAX_LENGTH}
          rows={6}
          value={message}
          onChange={(event) => setMessage(event.target.value)}
          placeholder="어떤 점이 불편했는지, 어떤 기능이 있으면 좋을지 자유롭게 남겨주세요."
          className="resize-none rounded-lg border border-zinc-300 px-3 py-2 text-sm outline-none focus:border-zinc-500 dark:border-zinc-700 dark:bg-zinc-900"
        />
      </div>

      {error && <p className="text-xs font-medium text-red-600 dark:text-red-400">{error}</p>}

      <button
        type="submit"
        disabled={isSubmitting || message.trim().length < MESSAGE_MIN_LENGTH}
        className="w-fit rounded-full bg-zinc-900 px-5 py-2.5 text-sm font-medium text-white transition-colors hover:bg-zinc-700 disabled:cursor-not-allowed disabled:opacity-40 dark:bg-zinc-50 dark:text-zinc-900 dark:hover:bg-zinc-200"
      >
        {isSubmitting ? "제출 중..." : "제출하기"}
      </button>
    </form>
  );
}
