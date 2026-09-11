// "이용 방법" 섹션 오른쪽의 정적 목업이다. 실제 UI(의뢰 뱃지, 선택됨 칩)와
// 동일한 스타일을 재사용하되, 장식용 버튼은 실제 동작하지 않으므로 <div>로 둔다.
const MOCK_PROPOSALS = [
  { name: "제작자 A", price: "250,000원", duration: "14일", selected: false },
  { name: "제작자 B", price: "300,000원", duration: "7일", selected: true },
  { name: "제작자 C", price: "220,000원", duration: "21일", selected: false },
] as const;

export function RequestFlowShowcase() {
  return (
    <div
      aria-hidden
      className="rounded-2xl bg-paper p-5 shadow-[0_1px_2px_rgba(0,0,0,0.04)] ring-1 ring-zinc-950/[0.06]"
    >
      <p className="text-xs font-medium text-zinc-400">진행 과정 (예시)</p>

      <div className="mt-4 rounded-xl border border-zinc-950/[0.08] p-4">
        <div className="flex items-center gap-2 text-xs text-zinc-500">
          <span className="rounded-full bg-zinc-100 px-2 py-0.5 font-medium text-zinc-600">
            의뢰
          </span>
          <span>모집중</span>
        </div>
        <p className="mt-2 text-sm font-medium text-zinc-900">스마트스토어 주문 정리 자동화</p>
      </div>

      <div className="mt-3 flex flex-col gap-2">
        {MOCK_PROPOSALS.map((proposal) => (
          <div
            key={proposal.name}
            className={`flex items-center justify-between rounded-lg border p-3 text-sm ${
              proposal.selected ? "border-zinc-900 bg-zinc-50" : "border-zinc-950/[0.08]"
            }`}
          >
            <span className="text-zinc-700">{proposal.name}</span>
            <div className="flex items-center gap-2">
              <span className="text-zinc-500">
                {proposal.price} · {proposal.duration}
              </span>
              {proposal.selected && (
                <span className="rounded-full bg-ink px-2 py-0.5 text-xs font-medium text-paper">
                  선택됨
                </span>
              )}
            </div>
          </div>
        ))}
      </div>

      <div className="mt-4 rounded-lg bg-accent-tint px-3 py-2 text-xs font-medium text-accent ring-1 ring-accent/20">
        보안 스캔 통과 · 발견 항목 0건 · 확인 및 결제
      </div>
    </div>
  );
}
