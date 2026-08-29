import Link from "next/link";
import { redirect } from "next/navigation";
import { createListingAction } from "@/app/actions";
import { getSellerById } from "@/lib/data";
import { getCurrentSellerId } from "@/lib/session";
import { CATEGORIES } from "@/lib/types";
import { SourceTypeFields } from "./SourceTypeFields";

export default async function NewListingPage() {
  const sellerId = await getCurrentSellerId();
  if (!sellerId) {
    return (
      <main className="mx-auto w-full max-w-md flex-1 px-6 py-10">
        <h1 className="text-2xl font-bold">로그인이 필요합니다</h1>
        <p className="mt-4 text-sm text-zinc-500 dark:text-zinc-400">
          매물을 등록하려면 먼저 로그인해주세요.
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

  const seller = await getSellerById(sellerId);
  if (!seller?.emailVerified) {
    redirect("/verify-email");
  }

  return (
    <main className="mx-auto w-full max-w-2xl flex-1 px-6 py-10">
      <h1 className="text-2xl font-bold">매물 등록</h1>
      <p className="mt-2 text-sm text-zinc-500 dark:text-zinc-400">
        만든 자동화 봇/스크립트를 등록해보세요. 등록은 무료이며 수수료가
        없습니다. 제출하면 자동 보안 스캔이 실행되고, 문제가 발견되면
        게시 전에 검토 화면을 먼저 보여드립니다.
      </p>

      <form action={createListingAction} className="mt-8 flex flex-col gap-6">
        <div className="flex flex-col gap-1.5">
          <label htmlFor="title" className="text-sm font-medium">
            제목
          </label>
          <input
            id="title"
            name="title"
            type="text"
            required
            placeholder="예: 쿠팡 최저가 알림 봇"
            className="rounded-lg border border-zinc-300 px-3 py-2 text-sm outline-none focus:border-zinc-500 dark:border-zinc-700 dark:bg-zinc-900"
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <label htmlFor="category" className="text-sm font-medium">
            카테고리
          </label>
          <select
            id="category"
            name="category"
            required
            defaultValue=""
            className="rounded-lg border border-zinc-300 px-3 py-2 text-sm outline-none focus:border-zinc-500 dark:border-zinc-700 dark:bg-zinc-900"
          >
            <option value="" disabled>
              카테고리를 선택해주세요
            </option>
            {CATEGORIES.map((category) => (
              <option key={category} value={category}>
                {category}
              </option>
            ))}
          </select>
        </div>

        <div className="flex flex-col gap-1.5">
          <label htmlFor="price" className="text-sm font-medium">
            가격 (원)
          </label>
          <input
            id="price"
            name="price"
            type="number"
            min={0}
            step={1000}
            required
            placeholder="30000"
            className="rounded-lg border border-zinc-300 px-3 py-2 text-sm outline-none focus:border-zinc-500 dark:border-zinc-700 dark:bg-zinc-900"
          />
        </div>

        <SourceTypeFields />

        <div className="flex flex-col gap-1.5">
          <label htmlFor="description" className="text-sm font-medium">
            설명
          </label>
          <textarea
            id="description"
            name="description"
            required
            rows={6}
            placeholder="어떤 문제를 해결하는 봇인지, 어떻게 설치하고 사용하는지 설명해주세요."
            className="resize-none rounded-lg border border-zinc-300 px-3 py-2 text-sm outline-none focus:border-zinc-500 dark:border-zinc-700 dark:bg-zinc-900"
          />
        </div>

        <button
          type="submit"
          className="mt-2 rounded-full bg-zinc-900 px-5 py-2.5 text-sm font-medium text-white transition-colors hover:bg-zinc-700 dark:bg-zinc-50 dark:text-zinc-900 dark:hover:bg-zinc-200"
        >
          등록하기
        </button>
      </form>
    </main>
  );
}
