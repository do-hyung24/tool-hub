import { redirect } from "next/navigation";
import { getCurrentSellerId } from "@/lib/session";
import { requestAccountDeletionAction } from "@/app/authActions";
import { SUPPORT_EMAIL } from "@/lib/constants";

export default async function DeleteAccountPage() {
  const sellerId = await getCurrentSellerId();
  if (!sellerId) {
    redirect("/login");
  }

  return (
    <main className="mx-auto w-full max-w-md flex-1 px-6 py-10">
      <h1 className="text-2xl font-bold">회원 탈퇴</h1>
      <p className="mt-4 text-sm leading-relaxed text-zinc-700 dark:text-zinc-300">
        탈퇴 시 계정과 등록한 매물 정보는 14일간 보관 후 영구 삭제됩니다. 14일 이내에는{" "}
        {SUPPORT_EMAIL}로 연락 주시면 복구 가능합니다.
      </p>
      <form action={requestAccountDeletionAction} className="mt-8">
        <button
          type="submit"
          className="w-full rounded-full bg-red-600 px-5 py-2.5 text-sm font-medium text-white transition-colors hover:bg-red-700"
        >
          탈퇴 확인 및 계정 삭제
        </button>
      </form>
    </main>
  );
}
