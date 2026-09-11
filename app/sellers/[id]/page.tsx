import Link from "next/link";
import { notFound } from "next/navigation";
import { getSellerPublicProfile } from "@/lib/data";
import { getProfileImageSrc } from "@/lib/format";

// "가입 N개월차"(1~11개월) / "가입 N년차"(12개월 이상)로 표시한다. 정확한
// 가입일이 아닌 계정도 있을 수 있으므로(과거 계정은 이 컬럼이 생긴 시점으로
// 채워짐) 대략적인 표시로 충분하다.
function formatMembershipDuration(createdAt: string): string {
  const created = new Date(createdAt);
  const now = new Date();
  let months = (now.getFullYear() - created.getFullYear()) * 12 + (now.getMonth() - created.getMonth());
  if (now.getDate() < created.getDate()) {
    months -= 1;
  }
  months = Math.max(0, months);
  if (months < 12) {
    return `가입 ${months + 1}개월차`;
  }
  return `가입 ${Math.floor(months / 12)}년차`;
}

function StatBadge({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-zinc-200 px-4 py-3 dark:border-zinc-800">
      <p className="text-xs text-zinc-400 dark:text-zinc-500">{label}</p>
      <p className="mt-1 text-lg font-semibold text-zinc-900 dark:text-zinc-50">{value}</p>
    </div>
  );
}

export default async function SellerPublicProfilePage(props: PageProps<"/sellers/[id]">) {
  const { id } = await props.params;

  const profile = await getSellerPublicProfile(id);
  if (!profile) {
    notFound();
  }

  const imageSrc = getProfileImageSrc(profile.sellerId, profile.profileImageUrl);
  const initial = profile.nickname.trim().charAt(0) || "?";
  const hasActivity =
    profile.completedAsMaker > 0 ||
    profile.inProgressAsMaker > 0 ||
    profile.publishedListings.length > 0;

  return (
    <main className="mx-auto w-full max-w-2xl flex-1 px-6 py-10">
      <div className="flex items-center gap-4">
        {imageSrc ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={imageSrc} alt="" className="h-16 w-16 rounded-full object-cover" />
        ) : (
          <span className="flex h-16 w-16 items-center justify-center rounded-full bg-zinc-200 text-xl font-semibold text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300">
            {initial}
          </span>
        )}
        <div>
          <h1 className="text-xl font-bold">{profile.nickname}</h1>
          <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
            {formatMembershipDuration(profile.createdAt)}
          </p>
        </div>
      </div>

      {hasActivity ? (
        <div className="mt-8 flex flex-wrap gap-3">
          <StatBadge label="완료" value={`${profile.completedAsMaker}건`} />
          {profile.inProgressAsMaker > 0 && (
            <StatBadge label="진행 중" value={`${profile.inProgressAsMaker}건`} />
          )}
          <StatBadge label="마켓 매물" value={`${profile.publishedListings.length}개`} />
        </div>
      ) : (
        <p className="mt-8 rounded-xl border border-zinc-200 p-4 text-sm text-zinc-500 dark:border-zinc-800 dark:text-zinc-400">
          아직 활동 내역이 없어요.
        </p>
      )}

      {profile.publishedListings.length > 0 && (
        <div className="mt-10">
          <h2 className="text-sm font-semibold text-zinc-500 dark:text-zinc-400">공개 매물</h2>
          <ul className="mt-3 flex flex-col gap-2">
            {profile.publishedListings.map((listing) => (
              <li key={listing.id}>
                <Link
                  href={`/listings/${listing.id}`}
                  className="flex items-center justify-between gap-2 rounded-xl border border-zinc-200 p-4 transition-colors hover:border-zinc-400 dark:border-zinc-800 dark:hover:border-zinc-600"
                >
                  <span className="text-sm font-medium text-zinc-900 dark:text-zinc-50">
                    {listing.title}
                  </span>
                  {listing.scanStatus === "completed" && (
                    <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-emerald-50 px-2 py-1 text-xs font-medium text-emerald-700 dark:bg-emerald-950 dark:text-emerald-400">
                      🔍 스캔 완료
                    </span>
                  )}
                </Link>
              </li>
            ))}
          </ul>
        </div>
      )}
    </main>
  );
}
