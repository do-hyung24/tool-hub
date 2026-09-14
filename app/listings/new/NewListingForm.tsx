"use client";

import { useActionState } from "react";
import { createListingAction, type CreateListingState } from "@/app/actions";
import { CATEGORIES } from "@/lib/types";
import { ListingFormFields } from "./ListingFormFields";

const initialState: CreateListingState = {};

export function NewListingForm({
  sourceRequestId,
  prefillTitle,
  prefillDescription,
  settlementAccountExists,
}: {
  sourceRequestId?: string;
  prefillTitle?: string;
  prefillDescription?: string;
  settlementAccountExists: boolean;
}) {
  const [state, formAction, pending] = useActionState(createListingAction, initialState);

  return (
    <form action={formAction} className="mt-8 flex flex-col gap-6">
      <input type="hidden" name="sourceRequestId" value={sourceRequestId ?? ""} />
      <div className="flex flex-col gap-1.5">
        <label htmlFor="title" className="text-sm font-medium">
          제목
        </label>
        <input
          id="title"
          name="title"
          type="text"
          required
          defaultValue={prefillTitle}
          placeholder="예: 쿠팡 최저가 알림 봇"
          className="rounded-lg border border-zinc-300 px-3 py-2 text-sm outline-none focus:border-zinc-500 dark:border-zinc-700 dark:bg-zinc-900"
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <label htmlFor="category" className="text-sm font-medium">
          카테고리
        </label>
        <select
          id="category"
          name="category"
          required
          defaultValue=""
          className="rounded-lg border border-zinc-300 px-3 py-2 text-sm outline-none focus:border-zinc-500 dark:border-zinc-700 dark:bg-zinc-900"
        >
          <option value="" disabled>
            카테고리를 선택해주세요
          </option>
          {CATEGORIES.map((category) => (
            <option key={category} value={category}>
              {category}
            </option>
          ))}
        </select>
      </div>

      <ListingFormFields settlementAccountExists={settlementAccountExists} />

      <div className="flex flex-col gap-1.5">
        <label htmlFor="description" className="text-sm font-medium">
          설명
        </label>
        <textarea
          id="description"
          name="description"
          required
          rows={6}
          defaultValue={prefillDescription}
          placeholder="어떤 문제를 해결하는 봇인지, 어떻게 설치하고 사용하는지 설명해주세요."
          className="resize-none rounded-lg border border-zinc-300 px-3 py-2 text-sm outline-none focus:border-zinc-500 dark:border-zinc-700 dark:bg-zinc-900"
        />
      </div>

      {state.error && (
        <p className="text-sm font-medium text-red-600 dark:text-red-400">{state.error}</p>
      )}

      <button
        type="submit"
        disabled={pending}
        className="mt-2 rounded-full bg-zinc-900 px-5 py-2.5 text-sm font-medium text-white transition-colors hover:bg-zinc-700 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-zinc-50 dark:text-zinc-900 dark:hover:bg-zinc-200"
      >
        등록하기
      </button>
    </form>
  );
}
