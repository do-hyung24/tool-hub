import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentSellerId } from "@/lib/session";
import { getSellerSettlementAccount } from "@/lib/data";
import { updateSettlementAccountAction } from "./actions";

export default async function SettlementAccountPage(
  props: PageProps<"/account/settlement">
) {
  const searchParams = await props.searchParams;
  const sellerId = await getCurrentSellerId();
  if (!sellerId) {
    redirect("/login");
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

      <form action={updateSettlementAccountAction} className="mt-6 flex flex-col gap-4">
        <div className="flex flex-col gap-1.5">
          <label htmlFor="bankName" className="text-sm font-medium">
            은행명
          </label>
          <input
            id="bankName"
            name="bankName"
            type="text"
            defaultValue={account?.bankName ?? ""}
            placeholder="예: 국민은행"
            className="rounded-lg border border-zinc-300 px-3 py-2 text-sm outline-none focus:border-zinc-500 dark:border-zinc-700 dark:bg-zinc-900"
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <label htmlFor="accountHolder" className="text-sm font-medium">
            예금주명
          </label>
          <input
            id="accountHolder"
            name="accountHolder"
            type="text"
            defaultValue={account?.accountHolder ?? ""}
            placeholder="예: 홍길동"
            className="rounded-lg border border-zinc-300 px-3 py-2 text-sm outline-none focus:border-zinc-500 dark:border-zinc-700 dark:bg-zinc-900"
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <label htmlFor="accountNumber" className="text-sm font-medium">
            계좌번호
          </label>
          <input
            id="accountNumber"
            name="accountNumber"
            type="text"
            inputMode="numeric"
            defaultValue={account?.accountNumber ?? ""}
            placeholder="- 없이 숫자만 입력"
            className="rounded-lg border border-zinc-300 px-3 py-2 text-sm outline-none focus:border-zinc-500 dark:border-zinc-700 dark:bg-zinc-900"
          />
        </div>

        <button
          type="submit"
          className="mt-2 self-start rounded-full bg-zinc-900 px-5 py-2.5 text-sm font-medium text-white transition-colors hover:bg-zinc-700 dark:bg-zinc-50 dark:text-zinc-900 dark:hover:bg-zinc-200"
        >
          저장하기
        </button>
      </form>

      <p className="mt-6 text-xs text-zinc-400 dark:text-zinc-500">
        이 정보는 의뢰자가 완성본을 수락하기 전에는 누구에게도(마켓, 공개 프로필,
        제3자, 비로그인 방문자 포함) 노출되지 않습니다.
      </p>
    </main>
  );
}
