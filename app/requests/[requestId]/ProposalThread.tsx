"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { formatDate } from "@/lib/format";
import type { ToolProposalMessageWithAuthor } from "@/lib/types";

const CONTENT_MAX_LENGTH = 1000;

export function ProposalThread({
  proposalId,
  initialMessages,
}: {
  proposalId: string;
  initialMessages: ToolProposalMessageWithAuthor[];
}) {
  const router = useRouter();
  const [content, setContent] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    setIsSubmitting(true);
    try {
      const response = await fetch(`/api/requests/proposals/${proposalId}/messages`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content }),
      });
      const result = await response.json();
      if (!response.ok) {
        setError(result.error ?? "메시지 등록에 실패했습니다.");
        return;
      }
      setContent("");
      router.refresh();
    } catch {
      setError("메시지 등록 중 오류가 발생했습니다.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="mt-3 rounded-lg border border-zinc-200 p-3 dark:border-zinc-800">
      <h3 className="text-xs font-semibold text-zinc-500 dark:text-zinc-400">비공개 대화</h3>
      <ul className="mt-2 flex flex-col gap-2">
        {initialMessages.length === 0 && (
          <li className="text-xs text-zinc-400 dark:text-zinc-500">아직 메시지가 없습니다.</li>
        )}
        {initialMessages.map((message) => (
          <li key={message.id} className="rounded-md bg-zinc-50 p-2 text-sm dark:bg-zinc-900">
            <div className="flex items-center gap-2 text-xs text-zinc-500 dark:text-zinc-400">
              <span className="font-medium text-zinc-700 dark:text-zinc-300">
                {message.senderNickname}
              </span>
              <span>{formatDate(message.createdAt)}</span>
            </div>
            <p className="mt-1 whitespace-pre-wrap text-zinc-700 dark:text-zinc-300">
              {message.content}
            </p>
          </li>
        ))}
      </ul>

      <form onSubmit={handleSubmit} className="mt-3 flex flex-col gap-2">
        <textarea
          required
          rows={2}
          maxLength={CONTENT_MAX_LENGTH}
          value={content}
          onChange={(event) => setContent(event.target.value)}
          placeholder="메시지를 입력하세요."
          className="resize-none rounded-lg border border-zinc-300 px-3 py-2 text-sm outline-none focus:border-zinc-500 dark:border-zinc-700 dark:bg-zinc-900"
        />
        {error && <p className="text-xs font-medium text-red-600 dark:text-red-400">{error}</p>}
        <button
          type="submit"
          disabled={isSubmitting || !content.trim()}
          className="w-fit rounded-full bg-zinc-900 px-4 py-1.5 text-sm font-medium text-white transition-colors hover:bg-zinc-700 disabled:cursor-not-allowed disabled:opacity-40 dark:bg-zinc-50 dark:text-zinc-900 dark:hover:bg-zinc-200"
        >
          {isSubmitting ? "전송 중..." : "보내기"}
        </button>
      </form>
    </div>
  );
}
