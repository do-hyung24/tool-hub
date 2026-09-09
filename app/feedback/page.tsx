import Link from "next/link";
import { getCurrentSellerId } from "@/lib/session";
import { FeedbackForm } from "./FeedbackForm";

export default async function FeedbackPage() {
  const sellerId = await getCurrentSellerId();
  if (!sellerId) {
    return (
      <main className="mx-auto w-full max-w-md flex-1 px-6 py-10">
        <h1 className="text-2xl font-bold">로그인이 필요합니다</h1>
        <p className="mt-4 text-sm text-zinc-500 dark:text-zinc-400">
          피드백을 남기려면 먼저 로그인해주세요.
        </p>
        <Link
          href="/login"
          className="mt-6 inline-block rounded-full bg-zinc-900 px-5 py-2.5 text-sm font-medium text-white transition-colors hover:bg-zinc-700 dark:bg-zinc-50 dark:text-zinc-900 dark:hover:bg-zinc-200"
        >
          확인
        </Link>
      </main>
    );
  }

  return (
    <main className="mx-auto w-full max-w-md flex-1 px-6 py-10">
      <h1 className="text-2xl font-bold">고객의 목소리</h1>
      <p className="mt-2 text-sm text-zinc-500 dark:text-zinc-400">
        툴허브 플랫폼 자체에 대한 의견이나 버그 제보를 남겨주세요. 특정 매물에
        대한 문의나 봇/스크립트 제작 요청은 이 페이지가 아니라 판매자에게
        직접 연락해주세요.
      </p>
      <FeedbackForm />
    </main>
  );
}
