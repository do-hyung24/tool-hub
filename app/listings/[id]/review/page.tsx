import { notFound, redirect } from "next/navigation";
import { getListingForOwner, getScanReportForOwner } from "@/lib/data";
import { getCurrentSellerId } from "@/lib/session";
import { publishAnywayAction, rescanListingAction } from "@/app/actions";
import { SEVERITY_LABEL, SEVERITY_ORDER, SEVERITY_STYLE } from "@/lib/severityStyle";
import { SourceTypeFields } from "../../new/SourceTypeFields";

export default async function ListingReviewPage(
  props: PageProps<"/listings/[id]/review">
) {
  const { id } = await props.params;
  const sellerId = await getCurrentSellerId();
  if (!sellerId) {
    redirect("/login");
  }

  const listing = await getListingForOwner(id, sellerId);
  if (!listing) {
    notFound();
  }

  const report = await getScanReportForOwner(id, sellerId);
  const sortedFindings = report
    ? [...report.findings].sort(
        (a, b) => SEVERITY_ORDER.indexOf(a.severity) - SEVERITY_ORDER.indexOf(b.severity)
      )
    : [];

  return (
    <main className="mx-auto w-full max-w-2xl flex-1 px-6 py-10">
      <h1 className="text-2xl font-bold">보안 스캔 리포트</h1>
      <p className="mt-2 text-sm text-zinc-500 dark:text-zinc-400">
        &quot;{listing.title}&quot; 매물은 아직 게시되지 않았습니다. 이
        리포트는 작성자 본인에게만 보입니다.
      </p>

      {sortedFindings.length === 0 ? (
        <p className="mt-6 rounded-xl border border-zinc-200 p-4 text-sm text-zinc-700 dark:border-zinc-800 dark:text-zinc-300">
          발견된 문제 없음 (제한적 분석 기준).
        </p>
      ) : (
        <ul className="mt-6 flex flex-col gap-3">
          {sortedFindings.map((finding) => (
            <li
              key={finding.id}
              className="rounded-xl border border-zinc-200 p-4 dark:border-zinc-800"
            >
              <div className="flex flex-wrap items-center gap-2">
                <span
                  className={`rounded-full px-2.5 py-1 text-xs font-semibold ${SEVERITY_STYLE[finding.severity]}`}
                >
                  {SEVERITY_LABEL[finding.severity]}
                </span>
                <span className="text-xs text-zinc-500 dark:text-zinc-400">
                  신뢰도: {finding.confidence}
                </span>
                <span className="text-xs text-zinc-400 dark:text-zinc-500">
                  {finding.type}
                </span>
                <span className="text-xs text-zinc-400 dark:text-zinc-500">
                  {finding.cwe}
                </span>
              </div>
              <p className="mt-2 text-sm text-zinc-800 dark:text-zinc-200">
                {finding.description}
              </p>
              <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
                {finding.filePath}
                {finding.location ? ` · ${finding.location}` : ""}
              </p>
              {finding.maskedEvidence && (
                <p className="mt-1 font-mono text-xs text-zinc-500 dark:text-zinc-400">
                  근거: {finding.maskedEvidence}
                </p>
              )}
            </li>
          ))}
        </ul>
      )}

      <section className="mt-10 rounded-xl border border-zinc-200 p-5 dark:border-zinc-800">
        <h2 className="font-semibold">수정 없이 그대로 게시하기</h2>
        <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
          구매자에게 미리 알리는 것이 좋습니다. 필요하다면 아래에 안내 문구를
          남겨주세요 (선택 사항).
        </p>
        <form action={publishAnywayAction} className="mt-4 flex flex-col gap-3">
          <input type="hidden" name="listingId" value={listing.id} />
          <textarea
            name="disclosureNote"
            rows={3}
            placeholder="예: 일부 설정값은 예시용 더미키입니다. 실제 사용 전 본인 키로 교체해주세요."
            className="resize-none rounded-lg border border-zinc-300 px-3 py-2 text-sm outline-none focus:border-zinc-500 dark:border-zinc-700 dark:bg-zinc-900"
          />
          <button
            type="submit"
            className="self-start rounded-full bg-zinc-900 px-5 py-2.5 text-sm font-medium text-white transition-colors hover:bg-zinc-700 dark:bg-zinc-50 dark:text-zinc-900 dark:hover:bg-zinc-200"
          >
            그대로 게시하기
          </button>
        </form>
      </section>

      <section className="mt-6 rounded-xl border border-zinc-200 p-5 dark:border-zinc-800">
        <h2 className="font-semibold">수정 후 다시 스캔하기</h2>
        <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
          코드를 고친 뒤 아래에서 다시 입력하면 재스캔 후 게시됩니다.
        </p>
        <form action={rescanListingAction} className="mt-4 flex flex-col gap-4">
          <input type="hidden" name="listingId" value={listing.id} />
          <SourceTypeFields defaultCodeUrl={listing.codeUrl ?? undefined} />
          <button
            type="submit"
            className="self-start rounded-full border border-zinc-300 px-5 py-2.5 text-sm font-medium text-zinc-700 transition-colors hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
          >
            다시 스캔하기
          </button>
        </form>
      </section>
    </main>
  );
}
