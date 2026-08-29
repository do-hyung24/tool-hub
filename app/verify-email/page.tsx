import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentSellerId } from "@/lib/session";
import { getSellerById } from "@/lib/data";
import { resendVerificationAction, verifyEmailCodeAction } from "@/app/authActions";

const CODE_ERROR_MESSAGES: Record<string, string> = {
  mismatch: "인증 코드가 올바르지 않습니다. 다시 확인해주세요.",
  expired: "인증 코드가 만료되었습니다. 재발송 버튼으로 새 코드를 받아주세요.",
  not_found: "발급된 인증 코드가 없습니다. 재발송 버튼으로 코드를 받아주세요.",
  locked: "시도 횟수를 너무 많이 초과했습니다. 재발송 버튼으로 새 코드를 받아주세요.",
  invalid: "6자리 숫자를 입력해주세요.",
};

export default async function VerifyEmailPage(
  props: PageProps<"/verify-email">
) {
  const searchParams = await props.searchParams;
  const sellerId = await getCurrentSellerId();
  if (!sellerId) {
    redirect("/login");
  }

  const seller = await getSellerById(sellerId);
  if (!seller) {
    redirect("/login");
  }

  const justVerified = searchParams.verified === "1";
  const justSent = searchParams.sent === "1";
  const hadLinkError = searchParams.error === "1";
  const codeErrorParam =
    typeof searchParams.codeError === "string" ? searchParams.codeError : null;
  const codeErrorMessage = codeErrorParam
    ? (CODE_ERROR_MESSAGES[codeErrorParam] ?? "인증에 실패했습니다. 다시 시도해주세요.")
    : null;

  return (
    <main className="mx-auto w-full max-w-md flex-1 px-6 py-10">
      <h1 className="text-2xl font-bold">이메일 인증이 필요합니다</h1>

      {seller.emailVerified || justVerified ? (
        <>
          <p className="mt-4 text-sm text-zinc-700 dark:text-zinc-300">
            ✓ 이메일 인증이 완료되었습니다. 이제 매물을 등록할 수 있어요.
          </p>
          <Link
            href="/listings/new"
            className="mt-6 inline-block rounded-full bg-zinc-900 px-5 py-2.5 text-sm font-medium text-white transition-colors hover:bg-zinc-700 dark:bg-zinc-50 dark:text-zinc-900 dark:hover:bg-zinc-200"
          >
            매물 등록하러 가기
          </Link>
        </>
      ) : (
        <>
          <p className="mt-4 text-sm text-zinc-500 dark:text-zinc-400">
            매물을 등록하려면 먼저 이메일 인증을 완료해주세요.{" "}
            <strong className="text-zinc-700 dark:text-zinc-300">{seller.email}</strong>
            로 6자리 인증 코드를 보내드렸습니다 (15분간 유효).
          </p>

          {justSent && (
            <p className="mt-4 rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-700 dark:bg-emerald-950 dark:text-emerald-400">
              인증 코드를 다시 보냈습니다. 받은편지함(또는 스팸함)을 확인해주세요.
            </p>
          )}
          {hadLinkError && (
            <p className="mt-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-950 dark:text-red-400">
              인증 링크가 유효하지 않거나 만료되었습니다. 재발송 버튼으로 다시 받아주세요.
            </p>
          )}
          {codeErrorMessage && (
            <p className="mt-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-950 dark:text-red-400">
              {codeErrorMessage}
            </p>
          )}

          <form action={verifyEmailCodeAction} className="mt-6 flex flex-col gap-3">
            <label htmlFor="code" className="text-sm font-medium">
              인증 코드 (6자리)
            </label>
            <input
              id="code"
              name="code"
              type="text"
              inputMode="numeric"
              pattern="[0-9]{6}"
              maxLength={6}
              required
              placeholder="000000"
              className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-center text-lg tracking-[0.4em] outline-none focus:border-zinc-500 dark:border-zinc-700 dark:bg-zinc-900"
            />
            <button
              type="submit"
              className="rounded-full bg-zinc-900 px-5 py-2.5 text-sm font-medium text-white transition-colors hover:bg-zinc-700 dark:bg-zinc-50 dark:text-zinc-900 dark:hover:bg-zinc-200"
            >
              인증하기
            </button>
          </form>

          <form action={resendVerificationAction} className="mt-4">
            <button
              type="submit"
              className="rounded-full border border-zinc-300 px-5 py-2.5 text-sm font-medium text-zinc-700 transition-colors hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
            >
              인증 코드 재발송
            </button>
          </form>
        </>
      )}
    </main>
  );
}
