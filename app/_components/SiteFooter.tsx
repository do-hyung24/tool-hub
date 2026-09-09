import Link from "next/link";

export function SiteFooter() {
  return (
    <footer className="border-t border-zinc-200 dark:border-zinc-800">
      <div className="mx-auto flex w-full max-w-5xl items-center justify-center px-6 py-6">
        <Link
          href="/feedback"
          className="text-sm text-zinc-500 hover:underline dark:text-zinc-400"
        >
          고객의 목소리
        </Link>
      </div>
    </footer>
  );
}
