import { ResetPasswordForm } from "./ResetPasswordForm";

export default async function ResetPasswordPage(props: PageProps<"/reset-password">) {
  const searchParams = await props.searchParams;
  const token = typeof searchParams.token === "string" ? searchParams.token : "";

  return (
    <main className="mx-auto w-full max-w-md flex-1 px-6 py-10">
      <h1 className="text-2xl font-bold">비밀번호 재설정</h1>

      {token ? (
        <>
          <p className="mt-2 text-sm text-zinc-500 dark:text-zinc-400">
            새로 사용할 비밀번호를 입력해주세요.
          </p>
          <ResetPasswordForm token={token} />
        </>
      ) : (
        <p className="mt-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-950 dark:text-red-400">
          재설정 링크가 올바르지 않습니다. 비밀번호 찾기를 다시 요청해주세요.
        </p>
      )}
    </main>
  );
}
