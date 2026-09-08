"use client";

import { useActionState } from "react";
import Link from "next/link";
import { forgotPasswordAction, type ForgotPasswordState } from "@/app/authActions";

const initialState: ForgotPasswordState = {};

export default function ForgotPasswordPage() {
  const [state, formAction, pending] = useActionState(forgotPasswordAction, initialState);

  return (
    <main className="mx-auto w-full max-w-md flex-1 px-6 py-10">
      <h1 className="text-2xl font-bold">비밀번호 찾기</h1>
      <p className="mt-2 text-sm text-zinc-500 dark:text-zinc-400">
        가입할 때 사용한 이메일 주소를 입력하면 재설정 링크를 보내드려요.
      </p>

      {state.submitted ? (
        <p className="mt-6 rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-700 dark:bg-emerald-950 dark:text-emerald-400">
          해당 이메일로 가입된 계정이 있다면 재설정 메일을 보냈습니다. 받은편지함(또는
          스팸함)을 확인해주세요.
        </p>
      ) : (
        <form action={formAction} className="mt-8 flex flex-col gap-6">
          <div className="flex flex-col gap-1.5">
            <label htmlFor="email" className="text-sm font-medium">
              이메일
            </label>
            <input
              id="email"
              name="email"
              type="email"
              required
              autoComplete="email"
              placeholder="you@example.com"
              className="rounded-lg border border-zinc-300 px-3 py-2 text-sm outline-none focus:border-zinc-500 dark:border-zinc-700 dark:bg-zinc-900"
            />
          </div>

          <button
            type="submit"
            disabled={pending}
            className="mt-2 rounded-full bg-zinc-900 px-5 py-2.5 text-sm font-medium text-white transition-colors hover:bg-zinc-700 disabled:opacity-50 dark:bg-zinc-50 dark:text-zinc-900 dark:hover:bg-zinc-200"
          >
            재설정 메일 받기
          </button>
        </form>
      )}

      <p className="mt-6 text-sm text-zinc-500 dark:text-zinc-400">
        <Link href="/login" className="font-medium text-zinc-900 underline dark:text-zinc-50">
          로그인으로 돌아가기
        </Link>
      </p>
    </main>
  );
}
