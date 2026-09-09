import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentSellerId } from "@/lib/session";
import { getSellerById } from "@/lib/data";
import { getProfileImageSrc } from "@/lib/format";
import { ProfileImageUploader } from "./ProfileImageUploader";

export default async function AccountPage() {
  const sellerId = await getCurrentSellerId();
  if (!sellerId) {
    redirect("/login");
  }

  const seller = await getSellerById(sellerId);
  if (!seller) {
    redirect("/login");
  }

  return (
    <main className="mx-auto w-full max-w-md flex-1 px-6 py-10">
      <h1 className="text-2xl font-bold">계정 관리</h1>

      <section className="mt-8">
        <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-50">프로필 사진</h2>
        <div className="mt-3">
          <ProfileImageUploader
            initialImageUrl={getProfileImageSrc(sellerId, seller.profileImageUrl)}
          />
        </div>
      </section>

      <section className="mt-10 border-t border-zinc-200 pt-8 dark:border-zinc-800">
        <h2 className="text-sm font-semibold text-red-600 dark:text-red-400">회원 탈퇴</h2>
        <p className="mt-2 text-xs text-zinc-500 dark:text-zinc-400">
          탈퇴 시 계정과 등록한 매물 정보는 14일간 보관 후 영구 삭제됩니다.
        </p>
        <Link
          href="/account/delete"
          className="mt-3 inline-block text-xs text-zinc-400 hover:underline dark:text-zinc-500"
        >
          회원 탈퇴
        </Link>
      </section>
    </main>
  );
}
