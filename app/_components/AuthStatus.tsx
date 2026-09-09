import Link from "next/link";
import { auth } from "@/lib/auth";
import { logoutAction } from "@/app/authActions";
import { getSellerById } from "@/lib/data";
import { getProfileImageSrc } from "@/lib/format";

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

  // 프로필 사진은 자주 바뀔 수 있는 값이라 세션(JWT)에 캐시하지 않고 매번 DB에서 조회한다.
  const seller = await getSellerById(session.user.id);
  const profileImageSrc = getProfileImageSrc(session.user.id, seller?.profileImageUrl ?? null);

  return (
    <div className="flex items-center gap-3 text-sm">
      <Link href="/account" className="flex items-center gap-2">
        {profileImageSrc ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={profileImageSrc}
            alt=""
            className="h-8 w-8 rounded-full object-cover"
          />
        ) : (
          <span className="flex h-8 w-8 items-center justify-center rounded-full bg-zinc-200 text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400">
            <svg viewBox="0 0 24 24" fill="currentColor" className="h-5 w-5">
              <path d="M12 12c2.7 0 4.9-2.2 4.9-4.9S14.7 2.2 12 2.2 7.1 4.4 7.1 7.1 9.3 12 12 12Zm0 2.4c-3.3 0-9.8 1.6-9.8 4.9v2.5h19.6v-2.5c0-3.3-6.5-4.9-9.8-4.9Z" />
            </svg>
          </span>
        )}
        <span className="text-zinc-600 dark:text-zinc-300">{session.user.nickname}님</span>
      </Link>
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
