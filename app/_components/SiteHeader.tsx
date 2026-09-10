import Link from "next/link";
import { AuthStatus } from "./AuthStatus";

export function SiteHeader() {
  return (
    <header className="border-b border-zinc-200 dark:border-zinc-800">
      <div className="mx-auto flex w-full max-w-5xl items-center justify-between px-6 py-4">
        <div className="flex items-center gap-6">
          <Link
            href="/"
            className="text-sm font-medium text-zinc-600 hover:text-zinc-900 dark:text-zinc-300 dark:hover:text-zinc-50"
          >
            홈
          </Link>
          <Link
            href="/requests"
            className="text-sm font-medium text-zinc-600 hover:text-zinc-900 dark:text-zinc-300 dark:hover:text-zinc-50"
          >
            자동화 툴 의뢰
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
        </div>
      </div>
    </header>
  );
}
