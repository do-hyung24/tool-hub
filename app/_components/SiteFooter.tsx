import Link from "next/link";

const FOOTER_LINKS = [
  { href: "/requests", label: "자동화 툴 의뢰" },
  { href: "/listings", label: "마켓" },
  { href: "/community", label: "커뮤니티" },
  { href: "/feedback", label: "고객의 목소리" },
  { href: "/privacy", label: "개인정보처리방침" },
] as const;

export function SiteFooter() {
  return (
    <footer className="dark border-t border-white/5 bg-ink-2 text-zinc-50">
      <div className="mx-auto w-full max-w-5xl px-6 py-10">
        <div className="flex flex-col gap-8 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <p className="text-lg font-bold">툴허브</p>
            <p className="mt-1 text-sm text-zinc-400">
              자동화 툴을 의뢰하고, 만들고, 안전하게 받는 곳
            </p>
          </div>
          <nav className="flex flex-wrap gap-x-6 gap-y-2 text-sm text-zinc-400">
            {FOOTER_LINKS.map((link) => (
              <Link key={link.href} href={link.href} className="hover:text-zinc-50">
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
