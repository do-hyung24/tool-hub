"use client";

import { useActionState } from "react";
import { updateSettlementAccountAction, type SettlementAccountState } from "./actions";
import type { SellerSettlementAccount } from "@/lib/types";

const initialState: SettlementAccountState = {};

export function SettlementForm({ account }: { account: SellerSettlementAccount | null }) {
  const [state, formAction, pending] = useActionState(updateSettlementAccountAction, initialState);

  return (
    <form action={formAction} className="mt-6 flex flex-col gap-4">
      <div className="flex flex-col gap-1.5">
        <label htmlFor="bankName" className="text-sm font-medium">
          은행명
        </label>
        <input
          id="bankName"
          name="bankName"
          type="text"
          defaultValue={account?.bankName ?? ""}
          placeholder="예: 국민은행"
          className="rounded-lg border border-zinc-300 px-3 py-2 text-sm outline-none focus:border-zinc-500 dark:border-zinc-700 dark:bg-zinc-900"
        />
      </div>
      <div className="flex flex-col gap-1.5">
        <label htmlFor="accountHolder" className="text-sm font-medium">
          예금주명
        </label>
        <input
          id="accountHolder"
          name="accountHolder"
          type="text"
          defaultValue={account?.accountHolder ?? ""}
          placeholder="예: 홍길동"
          className="rounded-lg border border-zinc-300 px-3 py-2 text-sm outline-none focus:border-zinc-500 dark:border-zinc-700 dark:bg-zinc-900"
        />
      </div>
      <div className="flex flex-col gap-1.5">
        <label htmlFor="accountNumber" className="text-sm font-medium">
          계좌번호
        </label>
        <input
          id="accountNumber"
          name="accountNumber"
          type="text"
          inputMode="numeric"
          defaultValue={account?.accountNumber ?? ""}
          placeholder="- 없이 숫자만 입력"
          className="rounded-lg border border-zinc-300 px-3 py-2 text-sm outline-none focus:border-zinc-500 dark:border-zinc-700 dark:bg-zinc-900"
        />
      </div>

      {state.error && (
        <p className="text-sm font-medium text-red-600 dark:text-red-400">{state.error}</p>
      )}

      <button
        type="submit"
        disabled={pending}
        className="mt-2 self-start rounded-full bg-zinc-900 px-5 py-2.5 text-sm font-medium text-white transition-colors hover:bg-zinc-700 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-zinc-50 dark:text-zinc-900 dark:hover:bg-zinc-200"
      >
        저장하기
      </button>
    </form>
  );
}
