"use client";

import { type ReactNode, useEffect, useRef, useState } from "react";
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
  const [mobileOpen, setMobileOpen] = useState(false);
  const headerRef = useRef<HTMLElement>(null);

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

  // 경로가 바뀌면(모바일 메뉴의 링크를 눌러 이동한 경우 포함) 패널을 닫는다 -
  // 헤더는 레이아웃에 있어 페이지를 옮겨도 리마운트되지 않으므로 직접 닫아줘야 한다.
  useEffect(() => {
    setMobileOpen(false);
  }, [pathname]);

  // 패널이 열려 있을 때 헤더 바깥을 클릭하면 닫는다.
  useEffect(() => {
    if (!mobileOpen) return;
    function handlePointerDown(event: PointerEvent) {
      if (headerRef.current && !headerRef.current.contains(event.target as Node)) {
        setMobileOpen(false);
      }
    }
    document.addEventListener("pointerdown", handlePointerDown);
    return () => document.removeEventListener("pointerdown", handlePointerDown);
  }, [mobileOpen]);

  // 홈 & 스크롤 전: 히어로와 같은 bg-ink 솔리드 배경(경계 없음)으로 히어로의
  // 연장처럼 이어 붙인다(투명 배경은 sticky 특성상 스크롤 전에는 히어로와
  // 겹치지 않아 body의 흰 배경이 그대로 비쳐 글씨가 안 보이는 문제가 있었다).
  // 홈 & 스크롤 후, 다른 모든 페이지: 항상 동일한 밝은 헤더(다른 페이지는 변경 없음).
  const transparentHome = isHome && !isScrolled;
  const headerClass = transparentHome
    ? "dark border-transparent bg-ink"
    : isHome
    ? "border-zinc-200 bg-paper/85"
    : "border-zinc-200 bg-white/80 dark:border-zinc-800 dark:bg-black/80";

  return (
    <header
      ref={headerRef}
      className={`sticky top-0 z-40 border-b backdrop-blur transition-colors duration-200 ${headerClass}`}
    >
      <div className="mx-auto flex w-full max-w-5xl items-center justify-between px-6 py-4">
        <div className="flex items-center gap-6">
          <Link
            href="/"
            className="shrink-0 whitespace-nowrap text-lg font-bold text-zinc-900 dark:text-zinc-50"
          >
            툴허브
          </Link>
          <nav className="hidden items-center gap-6 sm:flex">
            {NAV_LINKS.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className="text-sm font-medium text-zinc-600 hover:text-zinc-900 dark:text-zinc-300 dark:hover:text-zinc-50"
              >
                {link.label}
              </Link>
            ))}
          </nav>
        </div>
        <div className="hidden items-center gap-4 sm:flex">{authStatus}</div>
        <button
          type="button"
          onClick={() => setMobileOpen((open) => !open)}
          aria-expanded={mobileOpen}
          aria-label={mobileOpen ? "메뉴 닫기" : "메뉴 열기"}
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md text-zinc-600 hover:bg-zinc-900/5 dark:text-zinc-300 dark:hover:bg-white/10 sm:hidden"
        >
          {mobileOpen ? (
            <svg aria-hidden viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth={1.5} className="h-5 w-5">
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 5l10 10M15 5L5 15" />
            </svg>
          ) : (
            <svg aria-hidden viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth={1.5} className="h-5 w-5">
              <path strokeLinecap="round" strokeLinejoin="round" d="M3 6h14M3 10h14M3 14h14" />
            </svg>
          )}
        </button>
      </div>
      {mobileOpen && (
        <div className="border-t border-zinc-200 px-6 py-4 dark:border-zinc-800 sm:hidden">
          <nav className="flex flex-col gap-4">
            {NAV_LINKS.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className="text-sm font-medium text-zinc-600 hover:text-zinc-900 dark:text-zinc-300 dark:hover:text-zinc-50"
              >
                {link.label}
              </Link>
            ))}
          </nav>
          <div className="mt-4 flex items-center gap-4 border-t border-zinc-200 pt-4 dark:border-zinc-800">
            {authStatus}
          </div>
        </div>
      )}
    </header>
  );
}
