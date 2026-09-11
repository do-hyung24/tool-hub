"use client";

import { type ReactNode, useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";

const NAV_LINKS = [
  { href: "/requests", label: "자동화 툴 의뢰" },
  { href: "/listings", label: "마켓" },
  { href: "/community", label: "커뮤니티" },
] as const;

const SCROLL_THRESHOLD_PX = 24;

// AuthStatus는 서버 컴포넌트(세션/DB 조회)라서 이 클라이언트 컴포넌트가 직접
// import할 수 없다 - 부모(app/layout.tsx)에서 children으로 내려받아 그대로 렌더링한다.
export function SiteHeader({ authStatus }: { authStatus: ReactNode }) {
  const pathname = usePathname();
  const isHome = pathname === "/";
  const [isScrolled, setIsScrolled] = useState(false);

  useEffect(() => {
    if (!isHome) return;

    setIsScrolled(window.scrollY >= SCROLL_THRESHOLD_PX);

    let ticking = false;
    function handleScroll() {
      if (ticking) return;
      ticking = true;
      window.requestAnimationFrame(() => {
        setIsScrolled(window.scrollY >= SCROLL_THRESHOLD_PX);
        ticking = false;
      });
    }

    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, [isHome]);

  // 홈 & 스크롤 전: 완전 투명(경계 없음)으로 히어로 위에 얹힌 듯 보이게 한다.
  // 홈 & 스크롤 후, 다른 모든 페이지: 항상 동일한 밝은 헤더(다른 페이지는 변경 없음).
  const transparentHome = isHome && !isScrolled;
  const headerClass = transparentHome
    ? "dark border-transparent bg-transparent backdrop-blur-none"
    : isHome
    ? "border-zinc-200 bg-paper/85"
    : "border-zinc-200 bg-white/80 dark:border-zinc-800 dark:bg-black/80";

  return (
    <header
      className={`sticky top-0 z-40 border-b backdrop-blur transition-colors duration-200 ${headerClass}`}
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
