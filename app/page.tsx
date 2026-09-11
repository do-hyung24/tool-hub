import Link from "next/link";
import { groupFindingsForBuyer, CATEGORY_IDS, CATEGORY_LABELS, getDetectorTypeCount } from "@/lib/findingCategories";
import type { Finding } from "@/lib/types";
import { HeroPrompt } from "./_components/HeroPrompt";
import { Reveal } from "./_components/Reveal";
import { ScanShowcase } from "./_components/ScanShowcase";
import { ScanSummaryCard } from "./_components/ScanSummaryCard";
import { HowItWorksTabs } from "./_components/HowItWorksTabs";
import { RequestFlowShowcase } from "./_components/RequestFlowShowcase";

// 보안 스캔 쇼케이스 섹션의 예시 findings. ScanShowcase의 코드 패널과 줄 번호가
// 맞춰져 있다(2행 critical, 5행 medium, 8행 high) - 실제 서비스 로직
// (groupFindingsForBuyer)을 그대로 태워서 카드 내용이 실제 화면과 달라 보이지
// 않게 한다.
const SCAN_SHOWCASE_FINDINGS: Finding[] = [
  {
    id: "showcase-1",
    severity: "critical",
    confidence: "high",
    type: "hardcoded-secret",
    cwe: "CWE-798",
    filePath: "sync_orders.py",
    location: "2번째 줄",
    maskedEvidence: "sk-l***...c9e2",
    description: "API 키로 보이는 문자열이 하드코딩되어 있습니다.",
  },
  {
    id: "showcase-2",
    severity: "high",
    confidence: "high",
    type: "dangerous-shell",
    cwe: "CWE-78",
    filePath: "sync_orders.py",
    location: "8번째 줄",
    maskedEvidence: null,
    description: "외부 입력을 셸 명령으로 그대로 실행합니다.",
  },
  {
    id: "showcase-3",
    severity: "medium",
    confidence: "medium",
    type: "insecure-tls",
    cwe: "CWE-295",
    filePath: "sync_orders.py",
    location: "5번째 줄",
    maskedEvidence: null,
    description: "TLS 인증서 검증을 비활성화한 상태로 통신합니다.",
  },
];

const PROMISES = [
  { label: "수수료", sentence: "플랫폼 수수료를 받지 않습니다." },
  { label: "보안 스캔", sentence: "모든 완성본과 매물이 자동 검사를 거칩니다." },
  { label: "비공개 조율", sentence: "세부 협의는 의뢰자와 선택된 제작자만 봅니다." },
  { label: "결제 시점", sentence: "완성본과 스캔 결과를 확인한 뒤에만 결제합니다." },
] as const;

const USE_CASES = [
  {
    title: "쇼핑몰 주문 정리",
    sentence:
      "스마트스토어 주문 내역을 매일 아침 엑셀로 내려받아 재고 시트에 정리하는 작업을 자동화하고 싶어요.",
  },
  {
    title: "SNS 댓글·DM 수집",
    sentence: "인스타그램 게시물의 댓글과 DM을 모아 구글시트에 정리하고 싶어요.",
  },
  {
    title: "엑셀 보고서 자동화",
    sentence: "여러 엑셀 파일을 합쳐 매주 월요일 보고서를 자동으로 만들고 싶어요.",
  },
  {
    title: "이메일 자동 분류",
    sentence: "Gmail로 오는 견적 요청 메일을 분류해서 시트에 기록하고 싶어요.",
  },
  {
    title: "가격·재고 모니터링",
    sentence: "경쟁사 사이트의 가격 변동을 매일 확인해서 알림을 받고 싶어요.",
  },
  {
    title: "알림 자동 발송",
    sentence: "주문 상태가 바뀌면 고객에게 카카오톡 알림을 자동으로 보내고 싶어요.",
  },
] as const;

type ComparisonMark = "check" | "x" | "dash" | "partial";
type ComparisonColumnKey = "toolhub" | "agency" | "diy";
type ComparisonRow = {
  label: string;
  toolhub: [ComparisonMark, string];
  agency: [ComparisonMark, string];
  diy: [ComparisonMark, string];
};

const COMPARISON_ROWS: ComparisonRow[] = [
  {
    label: "완성본 보안 검사",
    toolhub: ["check", "자동 스캔"],
    agency: ["x", "없음"],
    diy: ["dash", "본인 판단"],
  },
  {
    label: "플랫폼 수수료",
    toolhub: ["check", "0원"],
    agency: ["x", "발생"],
    diy: ["check", "없음"],
  },
  {
    label: "여러 제작자 제안 비교",
    toolhub: ["check", ""],
    agency: ["check", ""],
    diy: ["dash", "해당 없음"],
  },
  {
    label: "시작 방법",
    toolhub: ["check", "설명과 사진"],
    agency: ["partial", "요구사항 문서"],
    diy: ["x", "직접 코딩"],
  },
  {
    label: "결과물 확인 방식",
    toolhub: ["check", "스캔 리포트 확인 후 결제"],
    agency: ["partial", "수령 후 직접 확인"],
    diy: ["dash", ""],
  },
];

const COMPARISON_COLUMNS: Array<{ key: ComparisonColumnKey; title: string; highlight: boolean }> = [
  { key: "toolhub", title: "툴허브", highlight: true },
  { key: "agency", title: "일반 외주 플랫폼", highlight: false },
  { key: "diy", title: "직접 개발", highlight: false },
];

const FAQ_ITEMS = [
  {
    question: "의뢰 등록에 비용이 드나요?",
    answer: "등록과 제안 받기는 무료입니다. 완성본을 확인한 뒤에만 결제합니다.",
  },
  {
    question: "완성본은 누가 볼 수 있나요?",
    answer: "의뢰자와 선택된 제작자만 봅니다. 마켓에 자동 공개되지 않습니다.",
  },
  {
    question: "저작권은 누구에게 있나요?",
    answer: "제작자에게 있습니다. 제작자가 원하면 마켓에 별도로 등록할 수 있습니다.",
  },
  {
    question: "보안 스캔은 무엇을 검사하나요?",
    answer:
      "시크릿 노출, 위험 함수 호출, 안전하지 않은 통신, 안전하지 않은 역직렬화, 외부 데이터 전송 패턴 5개 카테고리를 규칙 기반으로 자동 분석합니다. 모든 문제를 찾아내는 것은 아닙니다.",
  },
  {
    question: "스캔에서 문제가 발견되면 어떻게 되나요?",
    answer:
      "제작자가 수정 후 다시 스캔하거나, 발견 항목을 공개한 채로 전달할 수 있습니다. 의뢰자는 결과를 보고 확인 여부를 결정합니다.",
  },
  {
    question: "개발 지식이 없어도 되나요?",
    answer:
      "지금 하는 일과 원하는 결과를 글과 사진으로 설명하면 됩니다. 사용하는 프로그램은 목록에서 고르기만 하면 됩니다.",
  },
] as const;

export default function Home() {
  const scanShowcaseGroups = groupFindingsForBuyer(SCAN_SHOWCASE_FINDINGS);

  return (
    <main className="flex-1">
      {/* ── A. Hero (dark) ── */}
      <section className="dark relative flex flex-col items-center justify-center overflow-hidden bg-ink px-6 pb-20 pt-28 text-center text-zinc-50 lg:pb-24 lg:pt-36">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0"
          style={{
            background: "radial-gradient(60% 50% at 50% 0%, rgba(140,207,176,0.10), transparent 70%)",
          }}
        />
        <div className="relative">
          <p className="text-xs font-medium tracking-[0.04em] text-accent-soft">
            자동화 툴 의뢰 플랫폼
          </p>
          <h1 className="mx-auto mt-4 max-w-3xl text-balance font-display text-4xl font-semibold leading-[1.12] tracking-[-0.03em] break-keep sm:text-5xl lg:text-[3.5rem]">
            설명 한 줄에서, 검증된 완성본까지.
          </h1>
          <p className="mx-auto mt-6 max-w-2xl break-keep text-[15px] leading-[1.7] text-zinc-400 lg:text-base">
            필요한 업무를 설명하면 제작자가 가격과 기간을 제안합니다. 완성본은 전달 전 자동 보안
            스캔을 거칩니다.
          </p>
          <div className="mt-10">
            <HeroPrompt />
          </div>
        </div>
      </section>

      {/* ── B. 약속 4개 (light, grid bg) ── */}
      <section className="relative bg-paper px-6 py-20 lg:py-24">
        <div aria-hidden className="lp-grid-bg pointer-events-none absolute inset-0" />
        <Reveal className="relative mx-auto max-w-6xl">
          <div className="grid grid-cols-2 gap-6 sm:grid-cols-4">
            {PROMISES.map((item) => (
              <div key={item.label} className="border-t border-zinc-950/[0.10] pt-5">
                <p className="text-xs font-medium tracking-[0.04em] text-zinc-500">{item.label}</p>
                <p className="mt-2 text-[15px] font-medium leading-snug text-zinc-900 tabular-nums">
                  {item.sentence}
                </p>
              </div>
            ))}
          </div>
        </Reveal>
      </section>

      {/* ── C. 활용 사례 6개 (light) ── */}
      <section className="border-t border-zinc-950/[0.06] bg-paper-2 px-6 py-20 lg:py-24">
        <div className="mx-auto max-w-6xl">
          <Reveal>
            <p className="text-xs font-medium tracking-[0.04em] text-accent">이런 일을 의뢰합니다</p>
            <h2 className="mt-3 font-display text-3xl font-semibold leading-tight tracking-[-0.02em] break-keep text-zinc-900 lg:text-4xl">
              의뢰는 이렇게 시작됩니다
            </h2>
          </Reveal>
          <div className="mt-12 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {USE_CASES.map((useCase) => (
              <Reveal key={useCase.title}>
                <Link
                  href={`/requests/new?desc=${encodeURIComponent(useCase.sentence)}`}
                  className="flex h-full flex-col rounded-2xl bg-paper p-6 shadow-[0_1px_2px_rgba(0,0,0,0.04)] ring-1 ring-zinc-950/[0.06] transition-shadow hover:shadow-md hover:ring-zinc-950/[0.14]"
                >
                  <h3 className="text-lg font-semibold tracking-[-0.01em] text-zinc-900">
                    {useCase.title}
                  </h3>
                  <p className="mt-2 line-clamp-2 text-[15px] leading-[1.7] text-zinc-600 lg:text-base">
                    {useCase.sentence}
                  </p>
                  <span className="mt-4 text-sm font-medium text-accent">이 예시로 시작 →</span>
                </Link>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* ── D. 보안 스캔 쇼케이스 (light 섹션 + 다크 패널) ── */}
      <section className="border-t border-zinc-950/[0.06] bg-paper px-6 py-20 lg:py-24">
        <div className="mx-auto max-w-6xl">
          <Reveal>
            <p className="text-xs font-medium tracking-[0.04em] text-accent">자동 보안 스캔</p>
            <h2 className="mt-3 font-display text-3xl font-semibold leading-tight tracking-[-0.02em] break-keep text-zinc-900 lg:text-4xl">
              받기 전에, 코드가 먼저 읽힙니다.
            </h2>
            <p className="mt-4 max-w-2xl break-keep text-[15px] leading-[1.7] text-zinc-600 lg:text-base">
              제작자가 보낸 완성본은 의뢰자에게 도착하기 전에 자동 보안 스캔을 거칩니다. 발견된
              항목은 숨기지 않고 심각도별로 그대로 보여드립니다.
            </p>
          </Reveal>

          <Reveal className="mt-12">
            <div className="dark rounded-3xl bg-ink p-8 text-zinc-50 ring-1 ring-white/5 lg:p-12">
              <div className="grid grid-cols-1 gap-8 lg:grid-cols-2">
                <ScanShowcase />
                <div>
                  <p className="text-xs font-medium text-zinc-500">
                    의뢰자에게 보이는 결과 (예시)
                  </p>
                  <div className="mt-2">
                    <ScanSummaryCard groups={scanShowcaseGroups} />
                  </div>
                  <div className="mt-6 grid grid-cols-3 gap-4 text-center">
                    <div className="flex items-baseline justify-center gap-1.5">
                      <span className="text-3xl font-medium tabular-nums text-zinc-50">
                        {CATEGORY_IDS.length}
                      </span>
                      <span className="text-xs text-zinc-500">공개 취약 카테고리</span>
                    </div>
                    <div className="flex items-baseline justify-center gap-1.5">
                      <span className="text-3xl font-medium tabular-nums text-zinc-50">
                        {getDetectorTypeCount()}
                      </span>
                      <span className="text-xs text-zinc-500">종 탐지 규칙</span>
                    </div>
                    <div className="flex items-baseline justify-center gap-1.5">
                      <span className="text-3xl font-medium tabular-nums text-zinc-50">전부</span>
                      <span className="text-xs text-zinc-500">예외 없는 완성본 스캔</span>
                    </div>
                  </div>
                </div>
              </div>

              <div className="mt-12 flex flex-wrap justify-center gap-2">
                {CATEGORY_LABELS.map((item) => (
                  <span
                    key={item.id}
                    className="rounded-full bg-white/[0.04] px-3 py-1.5 text-xs text-zinc-300 ring-1 ring-white/[0.08]"
                  >
                    {item.label}
                  </span>
                ))}
              </div>
              <p className="mt-6 text-center text-xs text-zinc-500">
                규칙 기반 자동 분석이며 모든 보안 문제를 찾아내지는 못합니다. 발견 항목은
                참고용입니다.
              </p>
            </div>
          </Reveal>
        </div>
      </section>

      {/* ── E. 이용 방법 (light) ── */}
      <section className="border-t border-zinc-950/[0.06] bg-paper-2 px-6 py-20 lg:py-24">
        <div className="mx-auto max-w-6xl">
          <Reveal>
            <p className="text-xs font-medium tracking-[0.04em] text-accent">이용 방법</p>
            <h2 className="mt-3 font-display text-3xl font-semibold leading-tight tracking-[-0.02em] break-keep text-zinc-900 lg:text-4xl">
              세 단계로 완료됩니다
            </h2>
          </Reveal>
          <div className="mt-12 grid grid-cols-1 gap-12 lg:grid-cols-2 lg:items-start">
            <Reveal>
              <HowItWorksTabs />
            </Reveal>
            <Reveal>
              <RequestFlowShowcase />
            </Reveal>
          </div>
        </div>
      </section>

      {/* ── F. 비교 (light) ── */}
      <section className="border-t border-zinc-950/[0.06] bg-paper px-6 py-20 lg:py-24">
        <div className="mx-auto max-w-6xl">
          <Reveal>
            <h2 className="font-display text-3xl font-semibold leading-tight tracking-[-0.02em] break-keep text-zinc-900 lg:text-4xl">
              왜 툴허브인가
            </h2>
          </Reveal>
          <div className="mt-12 grid grid-cols-1 gap-6 sm:grid-cols-3">
            {COMPARISON_COLUMNS.map((column) => (
              <Reveal key={column.key}>
                <div
                  className={
                    column.highlight
                      ? "dark h-full rounded-2xl bg-ink p-6 text-zinc-50 ring-1 ring-white/[0.06]"
                      : "h-full rounded-2xl bg-paper p-6 shadow-[0_1px_2px_rgba(0,0,0,0.04)] ring-1 ring-zinc-950/[0.06]"
                  }
                >
                  <h3
                    className={`text-lg font-semibold tracking-[-0.01em] ${
                      column.highlight ? "text-zinc-50" : "text-zinc-900"
                    }`}
                  >
                    {column.title}
                  </h3>
                  <ul className="mt-4 flex flex-col gap-4">
                    {COMPARISON_ROWS.map((row) => {
                      const [mark, text] = row[column.key];
                      return (
                        <li key={row.label} className="flex items-start gap-3">
                          <ComparisonMarkIcon mark={mark} dark={column.highlight} />
                          <div>
                            <p className={column.highlight ? "text-xs text-zinc-400" : "text-xs text-zinc-500"}>
                              {row.label}
                            </p>
                            {text && (
                              <p
                                className={
                                  column.highlight ? "text-sm text-zinc-200" : "text-sm text-zinc-700"
                                }
                              >
                                {text}
                              </p>
                            )}
                          </div>
                        </li>
                      );
                    })}
                  </ul>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* ── G. 마켓 티저 (light, 얇은 배너) ── */}
      <section className="border-y border-zinc-950/[0.06] bg-paper-2 px-6 py-8">
        <div className="mx-auto flex w-full max-w-6xl flex-col items-center justify-between gap-4 sm:flex-row">
          <p className="text-sm text-zinc-600">완성된 툴이 필요하다면</p>
          <Link href="/listings" className="text-sm font-medium text-accent hover:opacity-80">
            마켓 둘러보기 →
          </Link>
        </div>
      </section>

      {/* ── H. FAQ (light) ── */}
      <section className="border-t border-zinc-950/[0.06] bg-paper px-6 py-20 lg:py-24">
        <div className="mx-auto max-w-6xl">
          <Reveal>
            <h2 className="font-display text-3xl font-semibold leading-tight tracking-[-0.02em] text-zinc-900 lg:text-4xl">
              자주 묻는 질문
            </h2>
          </Reveal>
          <div className="mt-10 flex flex-col divide-y divide-zinc-950/[0.08]">
            {FAQ_ITEMS.map((item) => (
              <details key={item.question} className="group py-5">
                <summary className="flex cursor-pointer list-none items-center justify-between text-sm font-medium text-zinc-900">
                  {item.question}
                  <span
                    aria-hidden
                    className="ml-4 shrink-0 text-lg text-zinc-400 transition-transform group-open:rotate-45"
                  >
                    +
                  </span>
                </summary>
                <p className="mt-3 break-keep text-[15px] leading-[1.7] text-zinc-600 lg:text-base">
                  {item.answer}
                </p>
              </details>
            ))}
          </div>
        </div>
      </section>

      {/* ── I. 최종 CTA (dark) ── */}
      <section className="dark bg-ink px-6 py-20 text-center text-zinc-50 lg:py-24">
        <Reveal className="mx-auto max-w-2xl">
          <h2 className="font-display text-3xl font-semibold leading-tight tracking-[-0.02em] break-keep sm:text-4xl">
            첫 의뢰를 등록하세요
          </h2>
          <p className="mt-4 text-[15px] leading-[1.7] text-zinc-400 lg:text-base">
            등록은 무료입니다. 제안을 받기 전까지 비용은 없습니다.
          </p>
          <div className="mt-8">
            <HeroPrompt compact />
          </div>
        </Reveal>
      </section>
    </main>
  );
}

function ComparisonMarkIcon({ mark, dark = false }: { mark: ComparisonMark; dark?: boolean }) {
  if (mark === "check") {
    return (
      <svg
        aria-hidden
        viewBox="0 0 20 20"
        fill="none"
        stroke="currentColor"
        strokeWidth={1.5}
        className={`mt-0.5 h-5 w-5 shrink-0 ${dark ? "text-accent-soft" : "text-accent"}`}
      >
        <path strokeLinecap="round" strokeLinejoin="round" d="M4 10.5l3.5 3.5L16 6" />
      </svg>
    );
  }
  if (mark === "x") {
    return (
      <svg
        aria-hidden
        viewBox="0 0 20 20"
        fill="none"
        stroke="currentColor"
        strokeWidth={1.5}
        className="mt-0.5 h-5 w-5 shrink-0 text-zinc-400"
      >
        <path strokeLinecap="round" strokeLinejoin="round" d="M5 5l10 10M15 5L5 15" />
      </svg>
    );
  }
  if (mark === "partial") {
    return (
      <svg
        aria-hidden
        viewBox="0 0 20 20"
        fill="none"
        stroke="currentColor"
        strokeWidth={1.5}
        className="mt-0.5 h-5 w-5 shrink-0 text-amber-500"
      >
        <path strokeLinecap="round" strokeLinejoin="round" d="M10 4v8m0 4h.01" />
      </svg>
    );
  }
  return (
    <svg
      aria-hidden
      viewBox="0 0 20 20"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.5}
      className="mt-0.5 h-5 w-5 shrink-0 text-zinc-300"
    >
      <path strokeLinecap="round" strokeLinejoin="round" d="M5 10h10" />
    </svg>
  );
}
