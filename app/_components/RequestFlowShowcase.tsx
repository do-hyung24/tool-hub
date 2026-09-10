// "이용 방법" 섹션 오른쪽의 정적 목업이다. 실제 UI(의뢰 뱃지, 선택됨 칩)와
// 동일한 스타일을 재사용하되, 장식용 버튼은 실제 동작하지 않으므로 <div>로 둔다.
const MOCK_PROPOSALS = [
  { name: "제작자 A", price: "250,000원", selected: false },
  { name: "제작자 B", price: "300,000원", selected: true },
  { name: "제작자 C", price: "220,000원", selected: false },
] as const;

export function RequestFlowShowcase() {
  return (
    <div aria-hidden className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
      <p className="text-xs font-medium text-zinc-400">진행 과정 (예시)</p>

      <div className="mt-4 rounded-xl border border-zinc-200 p-4">
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
              proposal.selected ? "border-zinc-900 bg-zinc-50" : "border-zinc-200"
            }`}
          >
            <span className="text-zinc-700">{proposal.name}</span>
            <div className="flex items-center gap-2">
              <span className="text-zinc-500">{proposal.price}</span>
              {proposal.selected && (
                <span className="rounded-full bg-zinc-900 px-2 py-0.5 text-xs font-medium text-white">
                  선택됨
                </span>
              )}
            </div>
          </div>
        ))}
      </div>

      <div className="mt-4 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs font-medium text-emerald-700">
        보안 스캔 통과 · 발견 항목 0건 · 확인 및 결제
      </div>
    </div>
  );
}
