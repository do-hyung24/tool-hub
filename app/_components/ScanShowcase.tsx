import { SEVERITY_LABEL } from "@/lib/severityStyle";

type ShowcaseSeverity = "critical" | "high" | "medium";

// 장식용 예시 코드 - 실제 스캔 대상이 아니다. 마스킹된 키 값 외에는 실제
// 시크릿 형태의 문자열을 담지 않는다. 하이라이트 3줄의 실제 줄 번호(2/5/8)는
// app/page.tsx의 SCAN_SHOWCASE_FINDINGS의 location 문구와 맞춰져 있다.
const CODE_LINES = [
  "import os, requests",
  'API_KEY = "sk-live-7f3a...c9e2"',
  'URL = "https://api.shop.example/orders"',
  "def fetch_orders():",
  "    r = requests.get(URL, verify=False)",
  "    return r.json()",
  "def run(user_cmd):",
  '    os.system(f"python export.py {user_cmd}")',
  'if __name__ == "__main__":',
  "    run(input())",
];

const HIGHLIGHTS: Record<number, { severity: ShowcaseSeverity; delay: string }> = {
  2: { severity: "critical", delay: "0.6s" },
  5: { severity: "medium", delay: "2.4s" },
  8: { severity: "high", delay: "1.5s" },
};

const HIT_COLORS: Record<ShowcaseSeverity, { bg: string; border: string }> = {
  critical: { bg: "rgb(239 68 68 / 0.14)", border: "rgb(239 68 68)" },
  high: { bg: "rgb(249 115 22 / 0.14)", border: "rgb(249 115 22)" },
  medium: { bg: "rgb(245 158 11 / 0.14)", border: "rgb(245 158 11)" },
};

export function ScanShowcase() {
  return (
    <div className="relative overflow-hidden rounded-2xl bg-ink-2 ring-1 ring-white/[0.06]">
      <div className="lp-scan-beam" aria-hidden />
      <div className="flex items-center gap-1.5 border-b border-white/[0.08] px-4 py-3">
        <span className="h-2.5 w-2.5 rounded-full bg-zinc-700" />
        <span className="h-2.5 w-2.5 rounded-full bg-zinc-700" />
        <span className="h-2.5 w-2.5 rounded-full bg-zinc-700" />
        <span className="ml-2 font-mono text-xs text-muted">sync_orders.py</span>
      </div>
      <div aria-hidden className="overflow-x-auto px-2 py-4 font-mono text-[13px] leading-relaxed">
        {CODE_LINES.map((line, index) => {
          const lineNumber = index + 1;
          const highlight = HIGHLIGHTS[lineNumber];
          const style = highlight
            ? ({
                "--lp-hit-bg": HIT_COLORS[highlight.severity].bg,
                "--lp-hit-border": HIT_COLORS[highlight.severity].border,
                animationDelay: highlight.delay,
              } as React.CSSProperties)
            : undefined;
          return (
            <div
              key={lineNumber}
              style={style}
              className={`flex items-center gap-4 border-l-2 border-transparent px-2 ${
                highlight ? "lp-scan-hit" : ""
              }`}
            >
              <span className="w-5 shrink-0 select-none text-right text-zinc-600">
                {lineNumber}
              </span>
              <span className="flex-1 whitespace-pre text-code">{line || " "}</span>
              <span className="w-16 shrink-0 text-right">
                {highlight && (
                  <span className="rounded-full bg-zinc-800 px-2 py-0.5 text-[10px] font-medium text-zinc-300">
                    {SEVERITY_LABEL[highlight.severity]}
                  </span>
                )}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
