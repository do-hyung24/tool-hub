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

function EmptyRow({ label }: { label: string }) {
  return (
    <li className="py-6 text-center text-sm text-zinc-400 dark:text-zinc-500">{label}</li>
  );
}

function RequestGroup({
  title,
  emptyLabel,
  items,
  today,
}: {
  title: string;
  emptyLabel: string;
  items: MyRequestSummary[];
  today: string;
}) {
  return (
    <div className="mt-6">
      <h3 className="text-xs font-semibold uppercase tracking-wide text-zinc-400 dark:text-zinc-500">
        {title}
      </h3>
      <ul className="mt-2 flex flex-col divide-y divide-zinc-200 dark:divide-zinc-800">
        {items.length === 0 && <EmptyRow label={emptyLabel} />}
        {items.map((request) => (
          <li key={request.id} className="py-3">
            <Link
              href={`/requests/${request.id}`}
              className="flex items-center justify-between gap-3"
            >
              <div className="flex min-w-0 flex-1 flex-col gap-1">
                <div className="flex items-center gap-2 text-xs text-zinc-500 dark:text-zinc-400">
                  <span className="rounded-full bg-zinc-100 px-2 py-0.5 font-medium text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300">
                    {STATUS_LABELS[request.status]}
                  </span>
                  <span>
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
                </div>
                <p className="truncate font-medium text-zinc-900 dark:text-zinc-50">
                  {request.title}
                </p>
              </div>
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
  emptyLabel,
  items,
  today,
}: {
  title: string;
  emptyLabel: string;
  items: MyWorkSummary[];
  today: string;
}) {
  return (
    <div className="mt-6">
      <h3 className="text-xs font-semibold uppercase tracking-wide text-zinc-400 dark:text-zinc-500">
        {title}
      </h3>
      <ul className="mt-2 flex flex-col divide-y divide-zinc-200 dark:divide-zinc-800">
        {items.length === 0 && <EmptyRow label={emptyLabel} />}
        {items.map((work) => (
          <li key={work.proposalId} className="py-3">
            <Link
              href={`/requests/${work.requestId}`}
              className="flex items-center justify-between gap-3"
            >
              <div className="flex min-w-0 flex-1 flex-col gap-1">
                <div className="flex items-center gap-2 text-xs text-zinc-500 dark:text-zinc-400">
                  <span className="rounded-full bg-zinc-100 px-2 py-0.5 font-medium text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300">
                    {STATUS_LABELS[work.requestStatus]}
                  </span>
                  <span>
                    {formatPrice(work.price)} · {work.duration}
                  </span>
                </div>
                <p className="truncate font-medium text-zinc-900 dark:text-zinc-50">
                  {work.requestTitle}
                </p>
              </div>
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

      <section className="mt-8">
        <h2 className="text-sm font-semibold text-zinc-700 dark:text-zinc-200">내 의뢰</h2>
        <RequestGroup
          title="진행중"
          emptyLabel="진행중인 의뢰가 없습니다."
          items={requestsInProgress}
          today={today}
        />
        <RequestGroup
          title="모집중"
          emptyLabel="모집중인 의뢰가 없습니다."
          items={requestsOpen}
          today={today}
        />
        <RequestGroup
          title="완료"
          emptyLabel="완료한 의뢰가 없습니다."
          items={requestsCompleted}
          today={today}
        />
      </section>

      <section className="mt-10">
        <h2 className="text-sm font-semibold text-zinc-700 dark:text-zinc-200">내 작업</h2>
        <WorkGroup
          title="진행중"
          emptyLabel="진행중인 작업이 없습니다."
          items={workInProgress}
          today={today}
        />
        <WorkGroup
          title="제안함"
          emptyLabel="대기중인 제안이 없습니다."
          items={workPending}
          today={today}
        />
        <WorkGroup
          title="완료"
          emptyLabel="완료한 작업이 없습니다."
          items={workCompleted}
          today={today}
        />
      </section>
    </main>
  );
}
