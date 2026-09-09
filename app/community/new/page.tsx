import Link from "next/link";
import { getCurrentSellerId } from "@/lib/session";
import { NewPostForm } from "./NewPostForm";

export default async function NewCommunityPostPage() {
  const sellerId = await getCurrentSellerId();
  if (!sellerId) {
    return (
      <main className="mx-auto w-full max-w-md flex-1 px-6 py-10">
        <h1 className="text-2xl font-bold">로그인이 필요합니다</h1>
        <p className="mt-4 text-sm text-zinc-500 dark:text-zinc-400">
          글을 작성하려면 먼저 로그인해주세요.
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
      <h1 className="text-2xl font-bold">글쓰기</h1>
      <NewPostForm />
    </main>
  );
}
