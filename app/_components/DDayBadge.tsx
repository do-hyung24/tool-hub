import { daysBetween, formatDDay, getDDayColorClass } from "@/lib/dday";

// 순수 프레젠테이션 컴포넌트(훅 없음)라 서버 컴포넌트(app/requests/[requestId]/page.tsx,
// app/my/page.tsx)와 클라이언트 컴포넌트(ProposalForm.tsx) 양쪽에서 그대로 재사용한다.
export function DDayBadge({ today, deadline }: { today: string; deadline: string }) {
  const diff = daysBetween(today, deadline);
  return (
    <span
      className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-medium ${getDDayColorClass(diff)}`}
    >
      {formatDDay(diff)}
    </span>
  );
}
