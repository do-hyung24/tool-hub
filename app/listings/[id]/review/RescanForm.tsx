"use client";

import { useActionState } from "react";
import { rescanListingAction } from "@/app/actions";
import type { CreateListingState } from "@/app/actions";
import { SourceTypeFields } from "../../new/SourceTypeFields";

const initialState: CreateListingState = {};

export function RescanForm({ listingId, defaultCodeUrl }: { listingId: string; defaultCodeUrl?: string }) {
  const [state, formAction, pending] = useActionState(rescanListingAction, initialState);

  return (
    <form action={formAction} className="mt-4 flex flex-col gap-4">
      <input type="hidden" name="listingId" value={listingId} />
      <SourceTypeFields defaultCodeUrl={defaultCodeUrl} />
      {state.error && (
        <p className="text-sm font-medium text-red-600 dark:text-red-400">{state.error}</p>
      )}
      <button
        type="submit"
        disabled={pending}
        className="self-start rounded-full border border-zinc-300 px-5 py-2.5 text-sm font-medium text-zinc-700 transition-colors hover:bg-zinc-100 disabled:cursor-not-allowed disabled:opacity-50 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
      >
        {pending ? "보안 검사 중..." : "다시 스캔하기"}
      </button>
    </form>
  );
}
