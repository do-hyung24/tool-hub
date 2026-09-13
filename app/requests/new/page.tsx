import Link from "next/link";
import { getCurrentSellerId } from "@/lib/session";
import { DraftSavedNotice } from "@/app/_components/DraftSavedNotice";
import { NewRequestForm } from "./NewRequestForm";

const DESC_MAX_LENGTH = 400;
const TITLE_MAX_LENGTH = 200;

export default async function NewRequestPage(props: PageProps<"/requests/new">) {
  const searchParams = await props.searchParams;
  const initialTitle =
    typeof searchParams.title === "string" ? searchParams.title.slice(0, TITLE_MAX_LENGTH) : "";
  const initialDescription =
    typeof searchParams.desc === "string" ? searchParams.desc.slice(0, DESC_MAX_LENGTH) : "";

  const sellerId = await getCurrentSellerId();
  if (!sellerId) {
    const params = new URLSearchParams();
    if (initialTitle) params.set("title", initialTitle);
    if (initialDescription) params.set("desc", initialDescription);
    const suffix = params.toString();
    const nextPath = `/requests/new${suffix ? `?${suffix}` : ""}`;
    return (
      <main className="mx-auto w-full max-w-md flex-1 px-6 py-10">
        <h1 className="text-2xl font-bold">로그인이 필요합니다</h1>
        <p className="mt-4 text-sm text-zinc-500 dark:text-zinc-400">
          의뢰를 등록하려면 먼저 로그인해주세요.
        </p>
        <DraftSavedNotice />
        <Link
          href={`/login?next=${encodeURIComponent(nextPath)}`}
          className="mt-6 inline-block rounded-full bg-zinc-900 px-5 py-2.5 text-sm font-medium text-white transition-colors hover:bg-zinc-700 dark:bg-zinc-50 dark:text-zinc-900 dark:hover:bg-zinc-200"
        >
          확인
        </Link>
      </main>
    );
  }

  return (
    <main className="mx-auto w-full max-w-md flex-1 px-6 py-10">
      <h1 className="text-2xl font-bold">의뢰 등록하기</h1>
      <NewRequestForm initialTitle={initialTitle} initialDescription={initialDescription} />
    </main>
  );
}
