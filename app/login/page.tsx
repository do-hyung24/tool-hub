"use client";

import { Suspense, useActionState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { loginAction, type LoginState } from "@/app/authActions";

const initialState: LoginState = {};

// 비밀번호 재설정 성공 후 /login?resetSuccess=1로 돌아왔을 때만 배너를 보여준다.
// useSearchParams는 정적 빌드 시 Suspense 경계가 필요하므로 별도로 분리한다.
function ResetSuccessBanner() {
  const searchParams = useSearchParams();
  if (searchParams.get("resetSuccess") !== "1") return null;
  return (
    <p className="mt-6 rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-700 dark:bg-emerald-950 dark:text-emerald-400">
      비밀번호가 재설정되었습니다. 새 비밀번호로 로그인해주세요.
    </p>
  );
}

// 탈퇴 요청이 접수되어 /login?accountDeleted=1로 돌아왔을 때만 안내 배너를 보여준다.
function AccountDeletionBanner() {
  const searchParams = useSearchParams();
  if (searchParams.get("accountDeleted") !== "1") return null;
  return (
    <p className="mt-6 rounded-lg bg-zinc-100 px-3 py-2 text-sm text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300">
      회원 탈퇴가 접수되었습니다. 계정과 매물 정보는 14일간 보관 후 삭제됩니다.
    </p>
  );
}

// 로그인 후 돌아갈 경로(?next=)를 hidden input으로 폼에 실어 보낸다. 실제 정제
// (오픈 리다이렉트 방지)는 서버 액션(loginAction)에서 safeNextPath로 한다.
function NextField() {
  const searchParams = useSearchParams();
  return <input type="hidden" name="next" value={searchParams.get("next") ?? ""} />;
}

// next가 있으면 회원가입 링크에도 그대로 이어 넘긴다(회원가입 자체가 next를
// 아직 쓰지 않더라도, 로그인 화면과의 연속성을 위해 최소한으로 전달만 해둔다).
function SignupLink() {
  const searchParams = useSearchParams();
  const next = searchParams.get("next");
  const href = next ? `/signup?next=${encodeURIComponent(next)}` : "/signup";
  return (
    <Link href={href} className="font-medium text-zinc-900 underline dark:text-zinc-50">
      회원가입
    </Link>
  );
}

export default function LoginPage() {
  const [state, formAction, pending] = useActionState(loginAction, initialState);

  return (
    <main className="mx-auto w-full max-w-md flex-1 px-6 py-10">
      <h1 className="text-2xl font-bold">로그인</h1>

      <Suspense fallback={null}>
        <ResetSuccessBanner />
      </Suspense>
      <Suspense fallback={null}>
        <AccountDeletionBanner />
      </Suspense>

      <form action={formAction} className="mt-8 flex flex-col gap-6">
        <Suspense fallback={null}>
          <NextField />
        </Suspense>
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

        <div className="flex flex-col gap-1.5">
          <label htmlFor="password" className="text-sm font-medium">
            비밀번호
          </label>
          <input
            id="password"
            name="password"
            type="password"
            required
            autoComplete="current-password"
            className="rounded-lg border border-zinc-300 px-3 py-2 text-sm outline-none focus:border-zinc-500 dark:border-zinc-700 dark:bg-zinc-900"
          />
        </div>

        {state.error && (
          <p className="text-sm font-medium text-red-600 dark:text-red-400">{state.error}</p>
        )}

        <button
          type="submit"
          disabled={pending}
          className="mt-2 rounded-full bg-zinc-900 px-5 py-2.5 text-sm font-medium text-white transition-colors hover:bg-zinc-700 disabled:opacity-50 dark:bg-zinc-50 dark:text-zinc-900 dark:hover:bg-zinc-200"
        >
          로그인
        </button>
      </form>

      <p className="mt-6 text-sm text-zinc-500 dark:text-zinc-400">
        <Link
          href="/forgot-password"
          className="font-medium text-zinc-900 underline dark:text-zinc-50"
        >
          비밀번호를 잊으셨나요?
        </Link>
      </p>

      <p className="mt-2 text-sm text-zinc-500 dark:text-zinc-400">
        아직 계정이 없나요?{" "}
        <Suspense
          fallback={
            <Link href="/signup" className="font-medium text-zinc-900 underline dark:text-zinc-50">
              회원가입
            </Link>
          }
        >
          <SignupLink />
        </Suspense>
      </p>
    </main>
  );
}
