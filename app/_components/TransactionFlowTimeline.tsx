type Stage = { title: string; body: string; note?: string };

const STAGES: Stage[] = [
  { title: "의뢰 등록", body: "필요한 자동화를 글과 사진으로 남겨요." },
  { title: "제작자가 금액·완료일 제안", body: "여러 제작자의 가격과 기간을 비교하고 하나를 선택해요." },
  {
    title: "수락하면 1:1 비공개 대화",
    body: "세부 협의는 의뢰자와 선택된 제작자만 보는 대화방에서 진행해요.",
    note: "대화 내용은 두 사람 외에는 공개되지 않아요.",
  },
  { title: "완성본 제출·보안 스캔", body: "제작자가 제출한 완성본은 플랫폼이 보관하며 자동 검사를 거쳐요." },
  {
    title: "확인 후 결제·다운로드",
    body: "결과를 확인한 뒤에만 결제하고, 그때 완성본을 내려받아요.",
    note: "중개 수수료 0% — 결제 금액은 전액 제작자에게 갑니다.",
  },
];

export function TransactionFlowTimeline() {
  return (
    <ol className="grid grid-cols-1 gap-8 sm:grid-cols-2 lg:grid-cols-5 lg:gap-6">
      {STAGES.map((stage, index) => (
        <li key={stage.title} className="flex flex-col gap-2 border-t-2 border-zinc-900/[0.08] pt-4">
          <span className="font-mono text-sm font-semibold text-zinc-400">
            {String(index + 1).padStart(2, "0")}
          </span>
          <h3 className="text-balance break-keep text-lg font-semibold tracking-[-0.01em] text-zinc-900">
            {stage.title}
          </h3>
          <p className="break-keep text-pretty text-[15px] leading-[1.7] text-zinc-600 lg:text-base">
            {stage.body}
          </p>
          {stage.note && (
            <p className="break-keep text-pretty text-xs text-zinc-400">{stage.note}</p>
          )}
        </li>
      ))}
    </ol>
  );
}
