import Link from "next/link";
import { auth } from "@/lib/auth";
import { logoutAction } from "@/app/authActions";

export async function AuthStatus() {
  const session = await auth();

  if (!session?.user) {
    return (
      <div className="flex items-center gap-3 text-sm">
        <Link href="/login" className="text-zinc-600 hover:underline dark:text-zinc-300">
          로그인
        </Link>
        <Link href="/signup" className="text-zinc-600 hover:underline dark:text-zinc-300">
          회원가입
        </Link>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-3 text-sm">
      <span className="text-zinc-600 dark:text-zinc-300">{session.user.nickname}님</span>
      <form action={logoutAction}>
        <button
          type="submit"
          className="rounded-md border border-zinc-300 px-2 py-1 text-xs text-zinc-600 hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
        >
          로그아웃
        </button>
      </form>
    </div>
  );
}
