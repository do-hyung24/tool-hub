import Link from "next/link";
import { getListings } from "@/lib/data";
import { getCurrentSellerId } from "@/lib/session";
import { groupFindingsForBuyer } from "@/lib/findingCategories";
import type { Finding } from "@/lib/types";
import { ListingBrowser } from "./_components/ListingBrowser";
import { ScanSummaryCard } from "./_components/ScanSummaryCard";
import { HowItWorksTabs } from "./_components/HowItWorksTabs";

// 매물 목록은 DB에서 실시간으로 바뀌므로 빌드 타임에 정적으로 굳히지 않는다.
export const dynamic = "force-dynamic";

// 히어로의 스캔 요약 카드는 실제 매물이 아니라 예시다. groupFindingsForBuyer로
// 실제 판매자 화면과 동일한 로직을 태워서, 실제 서비스와 다르게 보이지 않게 한다.
const HERO_EXAMPLE_FINDINGS: Finding[] = [
  {
    id: "example-1",
    severity: "high",
    confidence: "high",
    type: "hardcoded-secret",
    cwe: "CWE-798",
    filePath: "config.py",
    location: "12번째 줄",
    maskedEvidence: "AIz***...f2a",
    description: "API 키로 보이는 문자열이 하드코딩되어 있습니다.",
  },
  {
    id: "example-2",
    severity: "medium",
    confidence: "medium",
    type: "dangerous-shell",
    cwe: "CWE-78",
    filePath: "runner.py",
    location: "44번째 줄",
    maskedEvidence: null,
    description: "외부 입력을 셸 명령으로 그대로 실행합니다.",
  },
  {
    id: "example-3",
    severity: "low",
    confidence: "low",
    type: "data-exfiltration",
    cwe: "CWE-200",
    filePath: "sync.py",
    location: "9번째 줄",
    maskedEvidence: null,
    description: "외부 서버로 데이터를 전송하는 패턴이 발견되었습니다.",
  },
];

export default async function Home() {
  const [listings, sellerId] = await Promise.all([getListings(), getCurrentSellerId()]);

  // 실제 등록된 매물에 존재하는 카테고리만 필터 옵션으로 노출한다 (하드코딩 금지).
  const categories = Array.from(new Set(listings.map((listing) => listing.category))).sort();
  const heroExampleGroups = groupFindingsForBuyer(HERO_EXAMPLE_FINDINGS);
  const registerHref = sellerId ? "/listings/new" : "/login";

  return (
    <main className="flex-1">
      {/* ── Hero ── */}
      <section className="mx-auto grid w-full max-w-5xl grid-cols-1 gap-10 px-6 py-16 lg:grid-cols-[1.1fr_1fr] lg:items-center lg:py-24">
        <div>
          <h1 className="max-w-xl text-4xl font-bold tracking-tight break-keep text-zinc-900 sm:text-5xl dark:text-zinc-50">
            안심하고 거래하는 개인 제작 자동화 툴 마켓
          </h1>
          <p className="mt-4 max-w-lg text-base break-keep text-zinc-600 dark:text-zinc-400">
            직접 만든 자동화 봇/스크립트를 등록하면 하드코딩된 시크릿, 위험한
            코드 실행 같은 문제를 자동으로 찾아 구매자에게 투명하게 보여드립니다.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link
              href={registerHref}
              className="rounded-full bg-zinc-900 px-5 py-2.5 text-sm font-medium text-white transition-colors hover:bg-zinc-700 dark:bg-zinc-50 dark:text-zinc-900 dark:hover:bg-zinc-200"
            >
              내 툴 등록하고 스캔받기
            </Link>
            <a
              href="#marketplace"
              className="rounded-full border border-zinc-300 px-5 py-2.5 text-sm font-medium text-zinc-700 transition-colors hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
            >
              안전한 매물 둘러보기
            </a>
          </div>
        </div>

        <div>
          <p className="mb-2 text-xs font-medium text-zinc-400 dark:text-zinc-500">
            구매자에게 보이는 화면 (예시)
          </p>
          <ScanSummaryCard groups={heroExampleGroups} />
        </div>
      </section>

      {/* ── Trust 띠 ── */}
      <section className="border-y border-zinc-100 bg-zinc-50 dark:border-zinc-900 dark:bg-zinc-950/60">
        <div className="mx-auto flex w-full max-w-5xl flex-wrap gap-3 px-6 py-6">
          <TrustBadge>등록되는 모든 매물, AI 자동 보안 스캔 완료</TrustBadge>
          <TrustBadge>판매자 전용 상세 리포트 + 구매자 공개 요약, 예외 없이 제공</TrustBadge>
          <TrustBadge>수수료 없는 개인 간 직거래</TrustBadge>
        </div>
      </section>

      {/* ── Feature Highlight ── */}
      <section className="mx-auto w-full max-w-5xl px-6 py-16">
        <h2 className="text-2xl font-bold text-zinc-900 dark:text-zinc-50">
          등록부터 게시까지, 자동으로 확인해요
        </h2>

        <div className="mt-8 grid grid-cols-1 gap-6 sm:grid-cols-3">
          <FeatureCard icon="📦" title="쉬운 등록">
            zip 압축 파일이나 GitHub 저장소 링크만 있으면 바로 등록할 수 있어요.
          </FeatureCard>
          <FeatureCard icon="🔍" title="AI 자동 정밀 스캔">
            시크릿 노출, 위험한 코드 실행, 안전하지 않은 통신 등 여러 카테고리를
            자동으로 확인해요.
          </FeatureCard>
          <FeatureCard icon="📋" title="스캔 완료 매물로 게시">
            스캔이 끝나면 결과와 관계없이 &ldquo;스캔 완료&rdquo; 표시가 동일하게
            붙어요. 어떤 항목이 발견됐는지는 상세 페이지에서 그대로 확인할 수
            있어요.
          </FeatureCard>
        </div>

        <div className="mt-10 overflow-x-auto rounded-xl border border-zinc-200 dark:border-zinc-800">
          <table className="w-full min-w-[480px] border-collapse text-left text-sm">
            <thead>
              <tr className="border-b border-zinc-200 dark:border-zinc-800">
                <th className="p-4 font-medium text-zinc-500 dark:text-zinc-400">구분</th>
                <th className="p-4 font-medium text-zinc-500 dark:text-zinc-400">
                  일반 코드 거래
                </th>
                <th className="p-4 font-medium text-emerald-700 dark:text-emerald-400">
                  툴허브
                </th>
              </tr>
            </thead>
            <tbody>
              <ComparisonRow
                label="코드 내용 확인"
                baseline="구매 전에는 내용을 확인할 수 없음"
                toolhub="스캔 리포트로 발견 항목을 투명하게 공개"
              />
              <ComparisonRow
                label="위험 여부 판단"
                baseline="구매자가 스스로 판단할 방법이 없음"
                toolhub="카테고리별 심각도를 확인하고 구매 결정 가능"
              />
              <ComparisonRow
                label="스캔 리포트 제공"
                baseline="해당 없음"
                toolhub="결과와 무관하게 모든 매물에 동일하게 제공"
                last
              />
            </tbody>
          </table>
        </div>
      </section>

      {/* ── Live Marketplace Preview ── */}
      <section id="marketplace" className="mx-auto w-full max-w-5xl scroll-mt-6 px-6 py-16">
        <h2 className="mb-8 text-2xl font-bold text-zinc-900 dark:text-zinc-50">
          지금 등록된 매물
        </h2>
        <ListingBrowser listings={listings} categories={categories} />
      </section>

      {/* ── How It Works ── */}
      <section className="border-t border-zinc-100 dark:border-zinc-900">
        <div className="mx-auto w-full max-w-5xl px-6 py-16">
          <h2 className="mb-8 text-2xl font-bold text-zinc-900 dark:text-zinc-50">
            이용 방법
          </h2>
          <HowItWorksTabs />
        </div>
      </section>
    </main>
  );
}

function TrustBadge({ children }: { children: React.ReactNode }) {
  return (
    <span className="inline-flex items-center rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-xs font-medium text-emerald-700 dark:border-emerald-900 dark:bg-emerald-950 dark:text-emerald-400">
      {children}
    </span>
  );
}

function FeatureCard({
  icon,
  title,
  children,
}: {
  icon: string;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-xl border border-zinc-200 p-5 dark:border-zinc-800">
      <span className="text-2xl" aria-hidden>
        {icon}
      </span>
      <h3 className="mt-3 font-semibold text-zinc-900 dark:text-zinc-50">{title}</h3>
      <p className="mt-1.5 text-sm text-zinc-500 dark:text-zinc-400">{children}</p>
    </div>
  );
}

function ComparisonRow({
  label,
  baseline,
  toolhub,
  last = false,
}: {
  label: string;
  baseline: string;
  toolhub: string;
  last?: boolean;
}) {
  const rowClass = last ? "" : "border-b border-zinc-100 dark:border-zinc-900";
  return (
    <tr className={rowClass}>
      <td className="p-4 font-medium text-zinc-700 dark:text-zinc-300">{label}</td>
      <td className="p-4 text-zinc-500 dark:text-zinc-400">{baseline}</td>
      <td className="p-4 text-zinc-700 dark:text-zinc-300">{toolhub}</td>
    </tr>
  );
}
