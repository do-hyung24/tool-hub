"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

const TITLE_MIN_LENGTH = 2;
const CONTENT_MIN_LENGTH = 5;

export function NewRequestForm() {
  const router = useRouter();
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [budgetAmount, setBudgetAmount] = useState("");
  const [budgetNegotiable, setBudgetNegotiable] = useState(false);
  const [desiredDeadline, setDesiredDeadline] = useState("");
  const [requiredEnvironment, setRequiredEnvironment] = useState("");
  const [referenceVideoUrl, setReferenceVideoUrl] = useState("");
  const [images, setImages] = useState<File[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);

    if (images.length === 0) {
      setError("사진을 최소 1장 첨부해주세요.");
      return;
    }

    setIsSubmitting(true);
    try {
      const formData = new FormData();
      formData.append("title", title);
      formData.append("description", description);
      if (budgetAmount.trim() !== "") formData.append("budgetAmount", budgetAmount);
      if (budgetNegotiable) formData.append("budgetNegotiable", "on");
      if (desiredDeadline.trim() !== "") formData.append("desiredDeadline", desiredDeadline);
      if (requiredEnvironment.trim() !== "") formData.append("requiredEnvironment", requiredEnvironment);
      if (referenceVideoUrl.trim() !== "") formData.append("referenceVideoUrl", referenceVideoUrl);
      for (const file of images) {
        formData.append("images", file);
      }

      const response = await fetch("/api/requests", {
        method: "POST",
        body: formData,
      });
      const result = await response.json();
      if (!response.ok) {
        setError(result.error ?? "등록에 실패했습니다.");
        return;
      }
      router.push(`/requests/${result.id}`);
    } catch {
      setError("등록 중 오류가 발생했습니다. 다시 시도해주세요.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="mt-8 flex flex-col gap-6">
      <div className="flex flex-col gap-1.5">
        <label htmlFor="title" className="text-sm font-medium">
          제목
        </label>
        <input
          id="title"
          type="text"
          required
          minLength={TITLE_MIN_LENGTH}
          value={title}
          onChange={(event) => setTitle(event.target.value)}
          className="rounded-lg border border-zinc-300 px-3 py-2 text-sm outline-none focus:border-zinc-500 dark:border-zinc-700 dark:bg-zinc-900"
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <label htmlFor="description" className="text-sm font-medium">
          기능 설명
        </label>
        <textarea
          id="description"
          required
          minLength={CONTENT_MIN_LENGTH}
          rows={8}
          value={description}
          onChange={(event) => setDescription(event.target.value)}
          className="resize-none rounded-lg border border-zinc-300 px-3 py-2 text-sm outline-none focus:border-zinc-500 dark:border-zinc-700 dark:bg-zinc-900"
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <label htmlFor="budgetAmount" className="text-sm font-medium">
          예산
        </label>
        <div className="flex items-center gap-3">
          <input
            id="budgetAmount"
            type="number"
            min={0}
            value={budgetAmount}
            onChange={(event) => setBudgetAmount(event.target.value)}
            placeholder="금액(원)"
            className="w-40 rounded-lg border border-zinc-300 px-3 py-2 text-sm outline-none focus:border-zinc-500 dark:border-zinc-700 dark:bg-zinc-900"
          />
          <label className="flex items-center gap-1.5 text-sm text-zinc-600 dark:text-zinc-300">
            <input
              type="checkbox"
              checked={budgetNegotiable}
              onChange={(event) => setBudgetNegotiable(event.target.checked)}
              className="h-4 w-4 rounded border-zinc-300 dark:border-zinc-700"
            />
            협의 가능
          </label>
        </div>
      </div>

      <div className="flex flex-col gap-1.5">
        <label htmlFor="desiredDeadline" className="text-sm font-medium">
          희망 완료 시점
        </label>
        <input
          id="desiredDeadline"
          type="text"
          value={desiredDeadline}
          onChange={(event) => setDesiredDeadline(event.target.value)}
          className="rounded-lg border border-zinc-300 px-3 py-2 text-sm outline-none focus:border-zinc-500 dark:border-zinc-700 dark:bg-zinc-900"
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <label htmlFor="requiredEnvironment" className="text-sm font-medium">
          필요한 프로그램/환경
        </label>
        <input
          id="requiredEnvironment"
          type="text"
          value={requiredEnvironment}
          onChange={(event) => setRequiredEnvironment(event.target.value)}
          className="rounded-lg border border-zinc-300 px-3 py-2 text-sm outline-none focus:border-zinc-500 dark:border-zinc-700 dark:bg-zinc-900"
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <label htmlFor="referenceVideoUrl" className="text-sm font-medium">
          참고 영상 링크
        </label>
        <input
          id="referenceVideoUrl"
          type="text"
          value={referenceVideoUrl}
          onChange={(event) => setReferenceVideoUrl(event.target.value)}
          placeholder="https://..."
          className="rounded-lg border border-zinc-300 px-3 py-2 text-sm outline-none focus:border-zinc-500 dark:border-zinc-700 dark:bg-zinc-900"
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <label htmlFor="images" className="text-sm font-medium">
          사진 첨부
        </label>
        <input
          id="images"
          type="file"
          multiple
          accept="image/jpeg,image/png,image/webp"
          onChange={(event) => setImages(Array.from(event.target.files ?? []))}
          className="text-sm"
        />
        <p className="text-xs text-zinc-400 dark:text-zinc-500">사진을 최소 1장 첨부해주세요.</p>
      </div>

      <p className="text-xs text-zinc-400 dark:text-zinc-500">
        완성물은 제작자가 원하면 마켓에도 별도로 재판매할 수 있으며 저작권은 제작자에게 있습니다.
      </p>

      {error && <p className="text-xs font-medium text-red-600 dark:text-red-400">{error}</p>}

      <button
        type="submit"
        disabled={
          isSubmitting ||
          title.trim().length < TITLE_MIN_LENGTH ||
          description.trim().length < CONTENT_MIN_LENGTH ||
          images.length === 0
        }
        className="w-fit rounded-full bg-zinc-900 px-5 py-2.5 text-sm font-medium text-white transition-colors hover:bg-zinc-700 disabled:cursor-not-allowed disabled:opacity-40 dark:bg-zinc-50 dark:text-zinc-900 dark:hover:bg-zinc-200"
      >
        {isSubmitting ? "등록 중..." : "등록하기"}
      </button>
    </form>
  );
}
