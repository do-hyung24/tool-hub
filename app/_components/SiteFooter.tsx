"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const FOOTER_LINKS = [
  { href: "/requests", label: "자동화 툴 의뢰" },
  { href: "/listings", label: "마켓" },
  { href: "/community", label: "커뮤니티" },
  { href: "/feedback", label: "고객의 목소리" },
  { href: "/privacy", label: "개인정보처리방침" },
] as const;

// 홈은 풍성한 푸터(워드마크+태그라인+전체 링크), 그 외 모든 페이지는
// 미니멀 푸터(워드마크+개인정보처리방침 링크만)를 쓴다 - SiteHeader가
// usePathname()으로 홈/그 외를 구분하는 것과 동일한 방식.
export function SiteFooter() {
  const pathname = usePathname();
  const isHome = pathname === "/";

  if (!isHome) {
    return (
      <footer className="border-t border-zinc-200 dark:border-zinc-800">
        <div className="mx-auto flex w-full max-w-5xl flex-col gap-2 px-6 py-8 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-4">
            <span className="text-sm font-semibold text-zinc-900 dark:text-zinc-50">
              툴허브
            </span>
            <Link
              href="/privacy"
              className="text-sm text-zinc-500 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-50"
            >
              개인정보처리방침
            </Link>
          </div>
          <p className="text-xs text-zinc-400 dark:text-zinc-500">© 2026 툴허브</p>
        </div>
      </footer>
    );
  }

  return (
    <footer className="dark border-t border-white/5 bg-ink-2 text-zinc-50">
      <div className="mx-auto w-full max-w-5xl px-6 py-10">
        <div className="flex flex-col gap-8 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <p className="text-lg font-semibold">툴허브</p>
            <p className="mt-1 text-sm text-zinc-400">
              자동화 툴을 의뢰하고, 만들고, 안전하게 받는 곳
            </p>
          </div>
          <nav className="flex flex-wrap gap-x-6 gap-y-2 text-sm text-zinc-400">
            {FOOTER_LINKS.map((link) => (
              <Link key={link.href} href={link.href} className="hover:text-paper">
                {link.label}
              </Link>
            ))}
          </nav>
        </div>
        <p className="mt-8 text-xs text-zinc-500">© 2026 툴허브</p>
      </div>
    </footer>
  );
}
