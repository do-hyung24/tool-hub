import Link from "next/link";
import { listToolRequests, listToolRequestImages } from "@/lib/data";
import { formatDate } from "@/lib/format";
import type { ToolRequestStatus } from "@/lib/types";

const PAGE_SIZE = 20;

const STATUS_LABELS: Record<ToolRequestStatus, string> = {
  open: "모집중",
  in_progress: "진행중",
  completed: "완료",
};

export default async function RequestsPage(props: PageProps<"/requests">) {
  const searchParams = await props.searchParams;
  const pageParam = typeof searchParams.page === "string" ? Number(searchParams.page) : 1;
  const page = Number.isInteger(pageParam) && pageParam > 0 ? pageParam : 1;

  const { requests, total } = await listToolRequests({ page, pageSize: PAGE_SIZE });
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  const thumbnails = await Promise.all(
    requests.map(async (request) => {
      const images = await listToolRequestImages(request.id);
      return images[0] ?? null;
    })
  );

  function pageHref(targetPage: number) {
    const params = new URLSearchParams();
    if (targetPage > 1) params.set("page", String(targetPage));
    const query = params.toString();
    return query ? `/requests?${query}` : "/requests";
  }

  return (
    <main className="mx-auto w-full max-w-3xl flex-1 px-6 py-10">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">자동화 툴 의뢰</h1>
        <Link
          href="/requests/new"
          className="rounded-full bg-zinc-900 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-zinc-700 dark:bg-zinc-50 dark:text-zinc-900 dark:hover:bg-zinc-200"
        >
          의뢰 등록하기
        </Link>
      </div>

      <ul className="mt-6 flex flex-col divide-y divide-zinc-200 dark:divide-zinc-800">
        {requests.length === 0 && (
          <li className="py-10 text-center text-sm text-zinc-400 dark:text-zinc-500">
            아직 등록된 의뢰가 없습니다.
          </li>
        )}
        {requests.map((request, index) => {
          const thumbnail = thumbnails[index];
          return (
            <li key={request.id} className="py-4">
              <Link href={`/requests/${request.id}`} className="flex items-center gap-4">
                <div className="flex flex-1 flex-col gap-2">
                  <div className="flex items-center gap-2 text-xs text-zinc-500 dark:text-zinc-400">
                    <span className="rounded-full bg-zinc-100 px-2 py-0.5 font-medium text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300">
                      의뢰
                    </span>
                    <span>{STATUS_LABELS[request.status]}</span>
                    <span>{formatDate(request.createdAt)}</span>
                  </div>
                  <p className="font-medium text-zinc-900 dark:text-zinc-50">{request.title}</p>
                  <span className="text-xs text-zinc-500 dark:text-zinc-400">
                    {request.requesterNickname}
                  </span>
                </div>
                {thumbnail && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={`/api/requests/images/${thumbnail.id}`}
                    alt=""
                    className="h-16 w-16 shrink-0 rounded-lg object-cover"
                  />
                )}
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
