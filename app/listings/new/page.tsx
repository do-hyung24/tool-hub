import Link from "next/link";
import { redirect } from "next/navigation";
import { getSellerById, getSellerSettlementAccount } from "@/lib/data";
import { getCurrentSellerId } from "@/lib/session";
import { NewListingForm } from "./NewListingForm";

export default async function NewListingPage(props: PageProps<"/listings/new">) {
  const searchParams = await props.searchParams;
  const sourceRequestId =
    typeof searchParams.sourceRequestId === "string" ? searchParams.sourceRequestId : undefined;
  const prefillTitle = typeof searchParams.title === "string" ? searchParams.title : undefined;
  const prefillDescription =
    typeof searchParams.description === "string" ? searchParams.description : undefined;

  const sellerId = await getCurrentSellerId();
  if (!sellerId) {
    const params = new URLSearchParams();
    if (sourceRequestId) params.set("sourceRequestId", sourceRequestId);
    if (prefillTitle) params.set("title", prefillTitle);
    if (prefillDescription) params.set("description", prefillDescription);
    const suffix = params.toString();
    const nextPath = `/listings/new${suffix ? `?${suffix}` : ""}`;
    return (
      <main className="mx-auto w-full max-w-md flex-1 px-6 py-10">
        <h1 className="text-2xl font-bold">로그인이 필요합니다</h1>
        <p className="mt-4 text-sm text-zinc-500 dark:text-zinc-400">
          매물을 등록하려면 먼저 로그인해주세요.
        </p>
        <Link
          href={`/login?next=${encodeURIComponent(nextPath)}`}
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

  const settlementAccount = await getSellerSettlementAccount(sellerId);
  const settlementAccountExists =
    !!settlementAccount?.bankName && !!settlementAccount.accountHolder && !!settlementAccount.accountNumber;

  return (
    <main className="mx-auto w-full max-w-2xl flex-1 px-6 py-10">
      <h1 className="text-2xl font-bold">매물 등록</h1>
      <p className="mt-2 text-sm text-zinc-500 dark:text-zinc-400">
        만든 자동화 봇/스크립트를 등록해보세요. 등록은 무료이며 수수료가
        없습니다. 제출하면 자동 보안 스캔이 실행되고, 문제가 발견되면
        게시 전에 검토 화면을 먼저 보여드립니다.
      </p>

      <NewListingForm
        sourceRequestId={sourceRequestId}
        prefillTitle={prefillTitle}
        prefillDescription={prefillDescription}
        settlementAccountExists={settlementAccountExists}
      />
    </main>
  );
}
