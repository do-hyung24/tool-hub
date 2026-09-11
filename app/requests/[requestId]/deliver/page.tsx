import Link from "next/link";
import { notFound } from "next/navigation";
import { canDeliverProposal, getToolRequestById, listToolProposalsForRequest } from "@/lib/data";
import { getCurrentSellerId } from "@/lib/session";
import { submitDeliveryAction } from "@/app/requestActions";
import { SourceTypeFields } from "@/app/listings/new/SourceTypeFields";

// app/requestActions.ts의 DELIVERY_GUIDE_MIN_LENGTH와 반드시 같은 값이어야 한다
// (그쪽은 "use server" 파일이라 상수를 export할 수 없어 여기 그대로 둔다).
const DELIVERY_GUIDE_MIN_LENGTH = 20;
const DELIVERY_GUIDE_PLACEHOLDER = `· 필요한 것(설치할 프로그램, 필요한 계정/키)
· 설치 방법
· 실행 방법
· 자주 막히는 부분`;

export default async function DeliverRequestPage(
  props: PageProps<"/requests/[requestId]/deliver">
) {
  const { requestId } = await props.params;

  const [toolRequest, sellerId] = await Promise.all([
    getToolRequestById(requestId),
    getCurrentSellerId(),
  ]);

  if (!toolRequest) {
    notFound();
  }

  if (!sellerId) {
    return (
      <main className="mx-auto w-full max-w-md flex-1 px-6 py-10">
        <h1 className="text-2xl font-bold">로그인이 필요합니다</h1>
        <p className="mt-4 text-sm text-zinc-500 dark:text-zinc-400">
          완성본을 제출하려면 먼저 로그인해주세요.
        </p>
        <Link
          href="/login"
          className="mt-6 inline-block rounded-full bg-zinc-900 px-5 py-2.5 text-sm font-medium text-white transition-colors hover:bg-zinc-700 dark:bg-zinc-50 dark:text-zinc-900 dark:hover:bg-zinc-200"
        >
          확인
        </Link>
      </main>
    );
  }

  const proposals = await listToolProposalsForRequest(requestId);
  const selectedProposal = proposals.find((proposal) => proposal.status === "selected");
  // 이미 완료(결제 확인)된 의뢰에는 완성본을 다시 제출할 수 없다 - 서버 액션 쪽
  // requireDeliverableProposal과 동일한 기준이다.
  const canDeliver =
    !!selectedProposal &&
    toolRequest.status === "in_progress" &&
    (await canDeliverProposal(requestId, selectedProposal.id, sellerId));

  if (!canDeliver) {
    return (
      <main className="mx-auto w-full max-w-md flex-1 px-6 py-10">
        <h1 className="text-2xl font-bold">접근할 수 없습니다</h1>
        <p className="mt-4 text-sm text-zinc-500 dark:text-zinc-400">
          완성본은 이 의뢰에서 선택된 판매자만 제출할 수 있습니다.
        </p>
        <Link
          href={`/requests/${requestId}`}
          className="mt-6 inline-block rounded-full border border-zinc-300 px-5 py-2.5 text-sm font-medium text-zinc-700 transition-colors hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
        >
          의뢰로 돌아가기
        </Link>
      </main>
    );
  }

  return (
    <main className="mx-auto w-full max-w-2xl flex-1 px-6 py-10">
      <Link
        href={`/requests/${requestId}`}
        className="text-sm text-zinc-500 hover:underline dark:text-zinc-400"
      >
        ← 의뢰로 돌아가기
      </Link>

      <h1 className="mt-4 text-2xl font-bold">완성본 제출</h1>
      <p className="mt-2 text-sm text-zinc-500 dark:text-zinc-400">
        &quot;{toolRequest.title}&quot; 의뢰의 완성본을 제출합니다. 제출하면 자동
        보안 스캔이 실행되고, 문제가 발견되면 의뢰자에게 전달하기 전에 검토
        화면을 먼저 보여드립니다. 제출한 완성본은 <strong>의뢰자에게만</strong>{" "}
        전달되며 공개 마켓에는 노출되지 않습니다.
      </p>

      <form action={submitDeliveryAction} className="mt-8 flex flex-col gap-6">
        <input type="hidden" name="requestId" value={toolRequest.id} />
        <input type="hidden" name="proposalId" value={selectedProposal.id} />

        <SourceTypeFields />

        <div className="flex flex-col gap-1.5">
          <label htmlFor="deliveryGuide" className="text-sm font-medium">
            실행 가이드
          </label>
          <p className="text-xs text-zinc-500 dark:text-zinc-400">
            비개발자인 의뢰자가 그대로 따라 할 수 있도록 설치·실행 방법을 구체적으로
            적어주세요.
          </p>
          <textarea
            id="deliveryGuide"
            name="deliveryGuide"
            required
            minLength={DELIVERY_GUIDE_MIN_LENGTH}
            rows={6}
            placeholder={DELIVERY_GUIDE_PLACEHOLDER}
            className="resize-none rounded-lg border border-zinc-300 px-3 py-2 text-sm outline-none focus:border-zinc-500 dark:border-zinc-700 dark:bg-zinc-900"
          />
        </div>

        <button
          type="submit"
          className="mt-2 self-start rounded-full bg-zinc-900 px-5 py-2.5 text-sm font-medium text-white transition-colors hover:bg-zinc-700 dark:bg-zinc-50 dark:text-zinc-900 dark:hover:bg-zinc-200"
        >
          제출하기
        </button>
      </form>
    </main>
  );
}
