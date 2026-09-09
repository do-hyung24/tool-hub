import Link from "next/link";
import { listCommunityPosts } from "@/lib/data";
import { formatDate, getProfileImageSrc } from "@/lib/format";
import { COMMUNITY_CATEGORIES, type CommunityCategory } from "@/lib/types";

const PAGE_SIZE = 20;

function isCommunityCategory(value: string): value is CommunityCategory {
  return (COMMUNITY_CATEGORIES as readonly string[]).includes(value);
}

export default async function CommunityPage(props: PageProps<"/community">) {
  const searchParams = await props.searchParams;
  const categoryParam = typeof searchParams.category === "string" ? searchParams.category : "";
  const category = isCommunityCategory(categoryParam) ? categoryParam : null;
  const pageParam = typeof searchParams.page === "string" ? Number(searchParams.page) : 1;
  const page = Number.isInteger(pageParam) && pageParam > 0 ? pageParam : 1;

  const { posts, total } = await listCommunityPosts({ category, page, pageSize: PAGE_SIZE });
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  function categoryHref(value: CommunityCategory | null) {
    return value ? `/community?category=${encodeURIComponent(value)}` : "/community";
  }

  function pageHref(targetPage: number) {
    const params = new URLSearchParams();
    if (category) params.set("category", category);
    if (targetPage > 1) params.set("page", String(targetPage));
    const query = params.toString();
    return query ? `/community?${query}` : "/community";
  }

  return (
    <main className="mx-auto w-full max-w-3xl flex-1 px-6 py-10">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">커뮤니티</h1>
        <Link
          href="/community/new"
          className="rounded-full bg-zinc-900 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-zinc-700 dark:bg-zinc-50 dark:text-zinc-900 dark:hover:bg-zinc-200"
        >
          글쓰기
        </Link>
      </div>

      <div className="mt-6 flex flex-wrap gap-2 text-sm">
        <Link
          href={categoryHref(null)}
          className={`rounded-full px-3 py-1.5 ${
            category === null
              ? "bg-zinc-900 text-white dark:bg-zinc-50 dark:text-zinc-900"
              : "bg-zinc-100 text-zinc-600 hover:bg-zinc-200 dark:bg-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-700"
          }`}
        >
          전체
        </Link>
        {COMMUNITY_CATEGORIES.map((value) => (
          <Link
            key={value}
            href={categoryHref(value)}
            className={`rounded-full px-3 py-1.5 ${
              category === value
                ? "bg-zinc-900 text-white dark:bg-zinc-50 dark:text-zinc-900"
                : "bg-zinc-100 text-zinc-600 hover:bg-zinc-200 dark:bg-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-700"
            }`}
          >
            {value}
          </Link>
        ))}
      </div>

      <ul className="mt-6 flex flex-col divide-y divide-zinc-200 dark:divide-zinc-800">
        {posts.length === 0 && (
          <li className="py-10 text-center text-sm text-zinc-400 dark:text-zinc-500">
            아직 게시글이 없습니다.
          </li>
        )}
        {posts.map((post) => {
          const authorImageSrc = getProfileImageSrc(post.authorSellerId, post.authorProfileImageUrl);
          return (
            <li key={post.id} className="py-4">
              <Link href={`/community/${post.id}`} className="flex flex-col gap-2">
                <div className="flex items-center gap-2 text-xs text-zinc-500 dark:text-zinc-400">
                  <span className="rounded-full bg-zinc-100 px-2 py-0.5 font-medium text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300">
                    {post.category}
                  </span>
                  <span>{formatDate(post.createdAt)}</span>
                </div>
                <p className="font-medium text-zinc-900 dark:text-zinc-50">{post.title}</p>
                <div className="flex items-center gap-2">
                  {authorImageSrc ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={authorImageSrc}
                      alt=""
                      className="h-5 w-5 rounded-full object-cover"
                    />
                  ) : (
                    <span className="flex h-5 w-5 items-center justify-center rounded-full bg-zinc-200 text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400">
                      <svg viewBox="0 0 24 24" fill="currentColor" className="h-3 w-3">
                        <path d="M12 12c2.7 0 4.9-2.2 4.9-4.9S14.7 2.2 12 2.2 7.1 4.4 7.1 7.1 9.3 12 12 12Zm0 2.4c-3.3 0-9.8 1.6-9.8 4.9v2.5h19.6v-2.5c0-3.3-6.5-4.9-9.8-4.9Z" />
                      </svg>
                    </span>
                  )}
                  <span className="text-xs text-zinc-500 dark:text-zinc-400">
                    {post.authorNickname}
                  </span>
                </div>
              </Link>
            </li>
          );
        })}
      </ul>

      {totalPages > 1 && (
        <div className="mt-8 flex items-center justify-center gap-4 text-sm">
          {page > 1 ? (
            <Link href={pageHref(page - 1)} className="text-zinc-600 hover:underline dark:text-zinc-300">
              이전
            </Link>
          ) : (
            <span className="text-zinc-300 dark:text-zinc-700">이전</span>
          )}
          <span className="text-zinc-400 dark:text-zinc-500">
            {page} / {totalPages}
          </span>
          {page < totalPages ? (
            <Link href={pageHref(page + 1)} className="text-zinc-600 hover:underline dark:text-zinc-300">
              다음
            </Link>
          ) : (
            <span className="text-zinc-300 dark:text-zinc-700">다음</span>
          )}
        </div>
      )}
    </main>
  );
}
