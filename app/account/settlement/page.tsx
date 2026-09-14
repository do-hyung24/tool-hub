import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentSellerId } from "@/lib/session";
import { getSellerSettlementAccount } from "@/lib/data";
import { SettlementForm } from "./SettlementForm";

export default async function SettlementAccountPage(
  props: PageProps<"/account/settlement">
) {
  const searchParams = await props.searchParams;
  const sellerId = await getCurrentSellerId();
  if (!sellerId) {
    redirect("/login?next=/account/settlement");
  }

  const account = await getSellerSettlementAccount(sellerId);
  const saved = searchParams.saved === "1";

  return (
    <main className="mx-auto w-full max-w-md flex-1 px-6 py-10">
      <Link href="/account" className="text-sm text-zinc-500 hover:underline dark:text-zinc-400">
        ← 계정 관리로
      </Link>

      <h1 className="mt-4 text-2xl font-bold">정산 계좌</h1>
      <p className="mt-2 text-sm text-zinc-500 dark:text-zinc-400">
        의뢰를 완료하고 의뢰자가 완성본을 수락하면, 이 계좌가 의뢰자에게만 공개되어
        직접 이체를 받습니다. 휴대폰 본인인증이나 계좌 실명대조는 하지 않으니
        본인 명의 계좌인지 다시 한번 확인해주세요.
      </p>

      {saved && (
        <p className="mt-4 rounded-lg bg-zinc-100 px-3 py-2 text-sm text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300">
          저장되었습니다.
        </p>
      )}

      <SettlementForm account={account} />

      <p className="mt-6 text-xs text-zinc-400 dark:text-zinc-500">
        이 정보는 의뢰자가 완성본을 수락하기 전에는 누구에게도(마켓, 공개 프로필,
        제3자, 비로그인 방문자 포함) 노출되지 않습니다.
      </p>
    </main>
  );
}
