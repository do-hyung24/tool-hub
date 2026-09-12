import Link from "next/link";
import { listToolRequests, listToolRequestImages } from "@/lib/data";
import { getCurrentSellerId } from "@/lib/session";
import { formatDate } from "@/lib/format";
import { TOOL_REQUEST_STATUSES } from "@/lib/types";
import type { ToolRequestStatus } from "@/lib/types";

const PAGE_SIZE = 20;

const STATUS_LABELS: Record<ToolRequestStatus, string> = {
  open: "모집중",
  in_progress: "진행중",
  completed: "완료",
};

const STATUS_TABS: ToolRequestStatus[] = ["open", "in_progress", "completed"];

function isToolRequestStatus(value: string): value is ToolRequestStatus {
  return (TOOL_REQUEST_STATUSES as readonly string[]).includes(value);
}

export default async function RequestsPage(props: PageProps<"/requests">) {
  const searchParams = await props.searchParams;
  const statusParam = typeof searchParams.status === "string" ? searchParams.status : "";
  const status: ToolRequestStatus = isToolRequestStatus(statusParam) ? statusParam : "open";

  const pageParam = typeof searchParams.page === "string" ? Number(searchParams.page) : 1;
  const page = Number.isInteger(pageParam) && pageParam > 0 ? pageParam : 1;

  const sellerId = await getCurrentSellerId();

  const { requests, total } = await listToolRequests({
    page,
    pageSize: PAGE_SIZE,
    status,
    viewerSellerId: sellerId,
  });
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  // 완료 사례 공개 화이트리스트에 첨부파일(썸네일 포함)은 들어있지 않다 -
  // 당사자 여부와 무관하게 완료 탭 카드에는 썸네일을 아예 조회/노출하지 않는다.
  const thumbnails = await Promise.all(
    requests.map(async (request) => {
      if (status === "completed") return null;
      const images = await listToolRequestImages(request.id);
      return images[0] ?? null;
    })
  );

  function pageHref(targetStatus: ToolRequestStatus, targetPage: number) {
    const params = new URLSearchParams();
    params.set("status", targetStatus);
    if (targetPage > 1) params.set("page", String(targetPage));
    return `/requests?${params.toString()}`;
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

      <div className="mt-6 inline-flex rounded-full border border-zinc-200 p-0.5 text-sm dark:border-zinc-800">
        {STATUS_TABS.map((tab) => (
          <Link
            key={tab}
            href={pageHref(tab, 1)}
            aria-pressed={status === tab}
            className={`rounded-full px-4 py-1.5 font-medium transition-colors ${
              status === tab
                ? "bg-zinc-900 text-white dark:bg-zinc-50 dark:text-zinc-900"
                : "text-zinc-500 hover:text-zinc-700 dark:text-zinc-400 dark:hover:text-zinc-200"
            }`}
          >
            {STATUS_LABELS[tab]}
          </Link>
        ))}
      </div>

      {requests.length === 0 ? (
        status === "open" ? (
          <div className="mt-10 flex flex-col items-center gap-4 rounded-xl border border-dashed border-zinc-200 py-12 text-center dark:border-zinc-800">
            <p className="break-keep text-sm text-zinc-500 dark:text-zinc-400">
              지금은 모집중인 의뢰가 없어요. 제작자로 활동할 준비를 먼저 해두면
              새 의뢰가 올라왔을 때 바로 제안할 수 있어요.
            </p>
            <div className="flex flex-wrap items-center justify-center gap-3">
              <Link
                href="/account"
                className="rounded-full bg-zinc-900 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-zinc-700 dark:bg-zinc-50 dark:text-zinc-900 dark:hover:bg-zinc-200"
              >
                제작자 프로필 등록하기
              </Link>
              <Link
                href="/listings/new"
                className="rounded-full border border-zinc-300 px-4 py-2 text-sm font-medium text-zinc-700 transition-colors hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
              >
                내 툴 매물 등록하기
              </Link>
            </div>
          </div>
        ) : (
          <p className="mt-10 py-10 text-center text-sm text-zinc-400 dark:text-zinc-500">
            {status === "in_progress" ? "진행중인 의뢰가 없습니다." : "완료된 의뢰가 없습니다."}
          </p>
        )
      ) : (
        <ul className="mt-6 flex flex-col divide-y divide-zinc-200 dark:divide-zinc-800">
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
                      {request.status === "completed" && request.selectedProposalCompletionDate ? (
                        <span>완료 예정일 {formatDate(request.selectedProposalCompletionDate)}</span>
                      ) : (
                        <span>{formatDate(request.createdAt)}</span>
                      )}
                    </div>
                    <p className="break-keep font-medium text-zinc-900 dark:text-zinc-50">
                      {request.title}
                    </p>
                    {status === "completed" ? (
                      // 완료 공개 화이트리스트에 의뢰인 닉네임은 포함되지 않는다 -
                      // 제작자 귀속 공개(maker_attribution_public)가 켜졌을 때만 표시한다.
                      request.selectedSellerNickname && (
                        <span className="text-xs text-zinc-500 dark:text-zinc-400">
                          제작자 {request.selectedSellerNickname}
                        </span>
                      )
                    ) : (
                      <span className="text-xs text-zinc-500 dark:text-zinc-400">
                        {request.requesterNickname}
                      </span>
                    )}
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
      )}

      {totalPages > 1 && (
        <div className="mt-8 flex items-center justify-center gap-4 text-sm">
          {page > 1 ? (
            <Link
              href={pageHref(status, page - 1)}
              className="text-zinc-600 hover:underline dark:text-zinc-300"
            >
              이전
            </Link>
          ) : (
            <span className="text-zinc-300 dark:text-zinc-700">이전</span>
          )}
          <span className="text-zinc-400 dark:text-zinc-500">
            {page} / {totalPages}
          </span>
          {page < totalPages ? (
            <Link
              href={pageHref(status, page + 1)}
              className="text-zinc-600 hover:underline dark:text-zinc-300"
            >
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
