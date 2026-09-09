"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { USER_COMMUNITY_CATEGORIES, type CommunityCategory } from "@/lib/types";

const TITLE_MAX_LENGTH = 100;
const CONTENT_MIN_LENGTH = 5;
const CONTENT_MAX_LENGTH = 5000;

export function NewPostForm() {
  const router = useRouter();
  const [category, setCategory] = useState<CommunityCategory>(USER_COMMUNITY_CATEGORIES[0]);
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    setIsSubmitting(true);
    try {
      const response = await fetch("/api/community/posts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ category, title, content }),
      });
      const result = await response.json();
      if (!response.ok) {
        setError(result.error ?? "등록에 실패했습니다.");
        return;
      }
      router.push(`/community/${result.id}`);
    } catch {
      setError("등록 중 오류가 발생했습니다. 다시 시도해주세요.");
    } finally {
      setIsSubmitting(false);
    }
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
          onChange={(event) => setCategory(event.target.value as CommunityCategory)}
          className="rounded-lg border border-zinc-300 px-3 py-2 text-sm outline-none focus:border-zinc-500 dark:border-zinc-700 dark:bg-zinc-900"
        >
          {USER_COMMUNITY_CATEGORIES.map((value) => (
            <option key={value} value={value}>
              {value}
            </option>
          ))}
        </select>
      </div>

      <div className="flex flex-col gap-1.5">
        <label htmlFor="title" className="text-sm font-medium">
          제목
        </label>
        <input
          id="title"
          type="text"
          required
          minLength={2}
          maxLength={TITLE_MAX_LENGTH}
          value={title}
          onChange={(event) => setTitle(event.target.value)}
          className="rounded-lg border border-zinc-300 px-3 py-2 text-sm outline-none focus:border-zinc-500 dark:border-zinc-700 dark:bg-zinc-900"
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <label htmlFor="content" className="text-sm font-medium">
          내용
        </label>
        <textarea
          id="content"
          required
          minLength={CONTENT_MIN_LENGTH}
          maxLength={CONTENT_MAX_LENGTH}
          rows={10}
          value={content}
          onChange={(event) => setContent(event.target.value)}
          className="resize-none rounded-lg border border-zinc-300 px-3 py-2 text-sm outline-none focus:border-zinc-500 dark:border-zinc-700 dark:bg-zinc-900"
        />
      </div>

      {error && <p className="text-xs font-medium text-red-600 dark:text-red-400">{error}</p>}

      <button
        type="submit"
        disabled={isSubmitting || title.trim().length < 2 || content.trim().length < CONTENT_MIN_LENGTH}
        className="w-fit rounded-full bg-zinc-900 px-5 py-2.5 text-sm font-medium text-white transition-colors hover:bg-zinc-700 disabled:cursor-not-allowed disabled:opacity-40 dark:bg-zinc-50 dark:text-zinc-900 dark:hover:bg-zinc-200"
      >
        {isSubmitting ? "등록 중..." : "등록하기"}
      </button>
    </form>
  );
}
