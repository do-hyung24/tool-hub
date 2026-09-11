import Link from "next/link";
import { redirect } from "next/navigation";
import { listMyRequests, listMyWork } from "@/lib/data";
import { getCurrentSellerId } from "@/lib/session";
import { formatPrice } from "@/lib/format";
import type { MyRequestSummary, MyWorkSummary, ToolRequestStatus } from "@/lib/types";

const STATUS_LABELS: Record<ToolRequestStatus, string> = {
  open: "모집중",
  in_progress: "진행중",
  completed: "완료",
};

const DATE_ONLY_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

// 등록 폼(app/requests/new/NewRequestForm.tsx)과 동일한 방식으로 KST 오늘 날짜를 구한다.
function getKstTodayDateString(): string {
  return new Date(Date.now() + 9 * 60 * 60 * 1000).toISOString().slice(0, 10);
}

function daysBetween(fromDateStr: string, toDateStr: string): number {
  const from = new Date(`${fromDateStr}T00:00:00Z`).getTime();
  const to = new Date(`${toDateStr}T00:00:00Z`).getTime();
  return Math.round((to - from) / (24 * 60 * 60 * 1000));
}

function DDayBadge({ today, deadline }: { today: string; deadline: string }) {
  const diff = daysBetween(today, deadline);
  const label = diff > 0 ? `D-${diff}` : diff === 0 ? "D-DAY" : `D+${Math.abs(diff)}`;
  const colorClass =
    diff < 0
      ? "bg-red-50 text-red-700 dark:bg-red-950 dark:text-red-400"
      : diff <= 3
      ? "bg-amber-50 text-amber-700 dark:bg-amber-950 dark:text-amber-400"
      : "bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300";
  return (
    <span className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-medium ${colorClass}`}>
      {label}
    </span>
  );
}

// 진행중 항목에만 붙는 여분의 일정 표시 - 희망 완료시점이 있으면 D-day 뱃지,
// 없으면 대체 텍스트(내 작업은 제안 기간, 내 의뢰는 "희망 완료일 미정").
function DeadlineInfo({
  today,
  desiredDeadline,
  fallback,
}: {
  today: string;
  desiredDeadline: string | null;
  fallback: string;
}) {
  if (desiredDeadline && DATE_ONLY_PATTERN.test(desiredDeadline)) {
    return <DDayBadge today={today} deadline={desiredDeadline} />;
  }
  return <span className="shrink-0 text-xs text-zinc-400 dark:text-zinc-500">{fallback}</span>;
}

function StatusBadge({ status }: { status: ToolRequestStatus }) {
  return (
    <span className="shrink-0 rounded-full bg-zinc-100 px-2 py-0.5 text-xs font-medium text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300">
      {STATUS_LABELS[status]}
    </span>
  );
}

// 항목이 없는 하위 섹션은 제목·안내문구까지 통째로 렌더링하지 않는다.
function RequestGroup({
  title,
  items,
  today,
}: {
  title: string;
  items: MyRequestSummary[];
  today: string;
}) {
  if (items.length === 0) return null;

  return (
    <div className="mt-4">
      <h3 className="text-xs font-medium text-zinc-500 dark:text-zinc-400">{title}</h3>
      <ul className="mt-1.5 flex flex-col gap-2">
        {items.map((request) => (
          <li key={request.id}>
            <Link
              href={`/requests/${request.id}`}
              className="flex items-center gap-2 rounded-lg px-2 py-1.5 transition-colors hover:bg-zinc-50 dark:hover:bg-zinc-900"
            >
              <StatusBadge status={request.status} />
              <span className="min-w-0 flex-1 truncate text-sm font-medium text-zinc-900 dark:text-zinc-50">
                {request.title}
              </span>
              <span className="shrink-0 text-xs text-zinc-500 dark:text-zinc-400">
                제안{" "}
                <span
                  className={
                    request.proposalCount > 0
                      ? "font-medium text-accent"
                      : "text-zinc-400 dark:text-zinc-500"
                  }
                >
                  {request.proposalCount}개
                </span>
              </span>
              {request.status === "in_progress" && (
                <DeadlineInfo
                  today={today}
                  desiredDeadline={request.desiredDeadline}
                  fallback="희망 완료일 미정"
                />
              )}
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}

function WorkGroup({
  title,
  items,
  today,
}: {
  title: string;
  items: MyWorkSummary[];
  today: string;
}) {
  if (items.length === 0) return null;

  return (
    <div className="mt-4">
      <h3 className="text-xs font-medium text-zinc-500 dark:text-zinc-400">{title}</h3>
      <ul className="mt-1.5 flex flex-col gap-2">
        {items.map((work) => (
          <li key={work.proposalId}>
            <Link
              href={`/requests/${work.requestId}`}
              className="flex items-center gap-2 rounded-lg px-2 py-1.5 transition-colors hover:bg-zinc-50 dark:hover:bg-zinc-900"
            >
              <StatusBadge status={work.requestStatus} />
              <span className="min-w-0 flex-1 truncate text-sm font-medium text-zinc-900 dark:text-zinc-50">
                {work.requestTitle}
              </span>
              <span className="shrink-0 text-xs text-zinc-500 dark:text-zinc-400">
                {formatPrice(work.price)} · {work.duration}
              </span>
              {work.requestStatus === "in_progress" && (
                <DeadlineInfo
                  today={today}
                  desiredDeadline={work.desiredDeadline}
                  fallback={`기간: ${work.duration}`}
                />
              )}
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}

export default async function MyActivityPage() {
  const sellerId = await getCurrentSellerId();
  if (!sellerId) {
    redirect("/login?next=/my");
  }

  const [myRequests, myWork] = await Promise.all([listMyRequests(sellerId), listMyWork(sellerId)]);
  const today = getKstTodayDateString();

  const requestsInProgress = myRequests.filter((request) => request.status === "in_progress");
  const requestsOpen = myRequests.filter((request) => request.status === "open");
  const requestsCompleted = myRequests.filter((request) => request.status === "completed");

  const workInProgress = myWork.filter(
    (work) => work.myProposalStatus === "selected" && work.requestStatus === "in_progress"
  );
  const workPending = myWork.filter(
    (work) => work.myProposalStatus === "pending" && work.requestStatus === "open"
  );
  const workCompleted = myWork.filter((work) => work.requestStatus === "completed");

  const hasAnyRequests = myRequests.length > 0;
  const hasAnyWork = myWork.length > 0;

  return (
    <main className="mx-auto w-full max-w-3xl flex-1 px-6 py-10">
      <div className="flex items-center justify-between gap-4">
        <h1 className="text-2xl font-bold">내 활동</h1>
        <Link
          href={`/sellers/${sellerId}`}
          className="text-sm font-medium text-accent hover:opacity-80"
        >
          내 공개 프로필 보기 →
        </Link>
      </div>

      {!hasAnyRequests && !hasAnyWork ? (
        <div className="mt-16 flex flex-col items-center gap-4 text-center">
          <p className="text-sm text-zinc-500 dark:text-zinc-400">
            아직 의뢰하거나 제안한 활동이 없어요.
          </p>
          <div className="flex items-center gap-4">
            <Link
              href="/requests/new"
              className="rounded-full bg-zinc-900 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-zinc-700 dark:bg-zinc-50 dark:text-zinc-900 dark:hover:bg-zinc-200"
            >
              의뢰 등록하기
            </Link>
            <Link
              href="/requests"
              className="text-sm font-medium text-accent hover:opacity-80"
            >
              의뢰 둘러보기
            </Link>
          </div>
        </div>
      ) : (
        <>
          <section className="mt-8">
            <h2 className="text-sm font-semibold text-zinc-700 dark:text-zinc-200">내 의뢰</h2>
            {hasAnyRequests ? (
              <>
                <RequestGroup title="진행중" items={requestsInProgress} today={today} />
                <RequestGroup title="모집중" items={requestsOpen} today={today} />
                <RequestGroup title="완료" items={requestsCompleted} today={today} />
              </>
            ) : (
              <p className="mt-2 text-sm text-zinc-400 dark:text-zinc-500">
                아직 등록한 의뢰가 없어요.
              </p>
            )}
          </section>

          <section className="mt-6">
            <h2 className="text-sm font-semibold text-zinc-700 dark:text-zinc-200">내 작업</h2>
            {hasAnyWork ? (
              <>
                <WorkGroup title="진행중" items={workInProgress} today={today} />
                <WorkGroup title="제안함" items={workPending} today={today} />
                <WorkGroup title="완료" items={workCompleted} today={today} />
              </>
            ) : (
              <p className="mt-2 text-sm text-zinc-400 dark:text-zinc-500">
                아직 제안한 작업이 없어요.
              </p>
            )}
          </section>
        </>
      )}
    </main>
  );
}
