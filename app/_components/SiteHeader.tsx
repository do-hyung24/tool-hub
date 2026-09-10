"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";

const NAV_LINKS = [
  { href: "/requests", label: "자동화 툴 의뢰" },
  { href: "/listings", label: "마켓" },
  { href: "/community", label: "커뮤니티" },
] as const;

// AuthStatus는 서버 컴포넌트(세션/DB 조회)라서 이 클라이언트 컴포넌트가 직접
// import할 수 없다 - 부모(app/layout.tsx)에서 children으로 내려받아 그대로 렌더링한다.
export function SiteHeader({ authStatus }: { authStatus: ReactNode }) {
  const pathname = usePathname();
  const isHome = pathname === "/";

  return (
    <header
      className={`sticky top-0 z-40 border-b backdrop-blur ${
        isHome
          ? "dark border-zinc-800 bg-zinc-950/80"
          : "border-zinc-200 bg-white/80 dark:border-zinc-800 dark:bg-black/80"
      }`}
    >
      <div className="mx-auto flex w-full max-w-5xl items-center justify-between px-6 py-4">
        <div className="flex items-center gap-6">
          <Link href="/" className="text-lg font-bold text-zinc-900 dark:text-zinc-50">
            툴허브
          </Link>
          {NAV_LINKS.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="text-sm font-medium text-zinc-600 hover:text-zinc-900 dark:text-zinc-300 dark:hover:text-zinc-50"
            >
              {link.label}
            </Link>
          ))}
        </div>
        <div className="flex items-center gap-4">{authStatus}</div>
      </div>
    </header>
  );
}
