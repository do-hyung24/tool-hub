import Link from "next/link";
import { SignupForm } from "./SignupForm";

export default function SignupPage() {
  return (
    <main className="mx-auto w-full max-w-md flex-1 px-6 py-10">
      <h1 className="text-2xl font-bold">회원가입</h1>
      <p className="mt-2 text-sm text-zinc-500 dark:text-zinc-400">
        가입 후 이메일로 인증 링크를 보내드려요. 인증 전에도 로그인은 가능하지만,
        매물 등록은 이메일 인증 후에 할 수 있습니다.
      </p>

      <SignupForm />

      <p className="mt-6 text-sm text-zinc-500 dark:text-zinc-400">
        이미 계정이 있나요?{" "}
        <Link href="/login" className="font-medium text-zinc-900 underline dark:text-zinc-50">
          로그인
        </Link>
      </p>
    </main>
  );
}
