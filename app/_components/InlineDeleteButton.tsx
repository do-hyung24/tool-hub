"use client";

import { useActionState, useState } from "react";

type DeleteActionState = { error?: string };

// 브라우저 confirm() 대신 페이지 내 확인 단계로 삭제를 처리하는 공용 버튼.
// 게시물 삭제 4곳(커뮤니티 글/의뢰/매물/제안)이 전부 이 컴포넌트를 감싸
// 각자의 서버 액션 + hidden 필드만 다르게 넘긴다.
export function InlineDeleteButton({
  action,
  hiddenFields,
  label = "삭제",
  confirmMessage = "정말 삭제하시겠습니까? 되돌릴 수 없습니다.",
}: {
  action: (prevState: DeleteActionState, formData: FormData) => Promise<DeleteActionState>;
  hiddenFields: Record<string, string>;
  label?: string;
  confirmMessage?: string;
}) {
  const [state, formAction, pending] = useActionState(action, {});
  const [confirming, setConfirming] = useState(false);

  if (!confirming) {
    return (
      <button
        type="button"
        onClick={() => setConfirming(true)}
        className="rounded-full border border-red-300 px-3 py-1 text-xs font-medium text-red-600 transition-colors hover:bg-red-50 dark:border-red-800 dark:text-red-400 dark:hover:bg-red-950"
      >
        {label}
      </button>
    );
  }

  return (
    <form action={formAction} className="flex flex-col items-start gap-2">
      {Object.entries(hiddenFields).map(([name, value]) => (
        <input key={name} type="hidden" name={name} value={value} />
      ))}
      <p className="text-xs text-zinc-600 dark:text-zinc-300">{confirmMessage}</p>
      {state.error && (
        <p className="text-xs font-medium text-red-600 dark:text-red-400">{state.error}</p>
      )}
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => setConfirming(false)}
          disabled={pending}
          className="rounded-full border border-zinc-300 px-3 py-1 text-xs font-medium text-zinc-600 transition-colors hover:bg-zinc-100 disabled:cursor-not-allowed disabled:opacity-40 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
        >
          취소
        </button>
        <button
          type="submit"
          disabled={pending}
          className="rounded-full bg-red-600 px-3 py-1 text-xs font-medium text-white transition-colors hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-40"
        >
          {pending ? "삭제 중..." : "삭제 확정"}
        </button>
      </div>
    </form>
  );
}
