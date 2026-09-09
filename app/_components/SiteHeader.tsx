import Link from "next/link";
import { AuthStatus } from "./AuthStatus";

export function SiteHeader() {
  return (
    <header className="border-b border-zinc-200 dark:border-zinc-800">
      <div className="mx-auto flex w-full max-w-5xl items-center justify-between px-6 py-4">
        <div className="flex items-center gap-6">
          <Link href="/" className="text-lg font-bold text-zinc-900 dark:text-zinc-50">
            툴허브
          </Link>
          <Link
            href="/community"
            className="text-sm font-medium text-zinc-600 hover:text-zinc-900 dark:text-zinc-300 dark:hover:text-zinc-50"
          >
            커뮤니티
          </Link>
        </div>
        <div className="flex items-center gap-4">
          <AuthStatus />
          <Link
            href="/listings/new"
            className="rounded-full bg-zinc-900 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-zinc-700 dark:bg-zinc-50 dark:text-zinc-900 dark:hover:bg-zinc-200"
          >
            매물 등록하기
          </Link>
        </div>
      </div>
    </header>
  );
}
