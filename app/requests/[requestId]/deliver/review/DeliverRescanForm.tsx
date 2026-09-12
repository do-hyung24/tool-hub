"use client";

import { useActionState } from "react";
import { deliverRescanAction, type DeliveryFormState } from "@/app/requestActions";
import { SourceTypeFields } from "@/app/listings/new/SourceTypeFields";

// app/requestActions.ts의 DELIVERY_GUIDE_MIN_LENGTH와 반드시 같은 값이어야 한다
// (그쪽은 "use server" 파일이라 상수를 export할 수 없어 여기 그대로 둔다).
const DELIVERY_GUIDE_MIN_LENGTH = 20;
const DELIVERY_GUIDE_PLACEHOLDER = `· 필요한 것(설치할 프로그램, 필요한 계정/키)
· 설치 방법
· 실행 방법
· 자주 막히는 부분`;

const initialState: DeliveryFormState = {};

export function DeliverRescanForm({
  requestId,
  proposalId,
  defaultCodeUrl,
  defaultDeliveryGuide,
}: {
  requestId: string;
  proposalId: string;
  defaultCodeUrl?: string;
  defaultDeliveryGuide?: string;
}) {
  const [state, formAction, pending] = useActionState(deliverRescanAction, initialState);

  return (
    <form action={formAction} className="mt-4 flex flex-col gap-4">
      <input type="hidden" name="requestId" value={requestId} />
      <input type="hidden" name="proposalId" value={proposalId} />
      <SourceTypeFields defaultCodeUrl={defaultCodeUrl} />

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
          defaultValue={defaultDeliveryGuide ?? ""}
          placeholder={DELIVERY_GUIDE_PLACEHOLDER}
          className="resize-none rounded-lg border border-zinc-300 px-3 py-2 text-sm outline-none focus:border-zinc-500 dark:border-zinc-700 dark:bg-zinc-900"
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <label htmlFor="proofImages" className="text-sm font-medium">
          작동 증빙 스크린샷 (1장 이상 필수)
        </label>
        <p className="text-xs text-zinc-500 dark:text-zinc-400">
          고친 코드로 다시 실행되는 화면을 새로 캡처해 첨부해주세요.
        </p>
        <input
          id="proofImages"
          name="proofImages"
          type="file"
          accept="image/png, image/jpeg, image/webp"
          multiple
          required
          className="rounded-lg border border-zinc-300 px-3 py-2 text-sm outline-none file:mr-3 file:rounded-md file:border-0 file:bg-zinc-100 file:px-3 file:py-1.5 file:text-sm dark:border-zinc-700 dark:bg-zinc-900 dark:file:bg-zinc-800"
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <label htmlFor="proofVideo" className="text-sm font-medium">
          작동 증빙 영상 (선택)
        </label>
        <p className="text-xs text-zinc-500 dark:text-zinc-400">mp4 형식, 최대 20MB.</p>
        <input
          id="proofVideo"
          name="proofVideo"
          type="file"
          accept="video/mp4"
          className="rounded-lg border border-zinc-300 px-3 py-2 text-sm outline-none file:mr-3 file:rounded-md file:border-0 file:bg-zinc-100 file:px-3 file:py-1.5 file:text-sm dark:border-zinc-700 dark:bg-zinc-900 dark:file:bg-zinc-800"
        />
        <p className="flex items-center gap-1 text-xs text-accent">
          <svg
            aria-hidden
            viewBox="0 0 20 20"
            fill="none"
            stroke="currentColor"
            strokeWidth={1.5}
            className="h-3.5 w-3.5 shrink-0"
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M4 10.5l3.5 3.5L16 6" />
          </svg>
          작동 영상을 함께 올리면 의뢰인이 더 빨리 수락하고 결제합니다.
        </p>
      </div>

      {state.error && (
        <p className="text-sm font-medium text-red-600 dark:text-red-400">{state.error}</p>
      )}

      <button
        type="submit"
        disabled={pending}
        className="self-start rounded-full border border-zinc-300 px-5 py-2.5 text-sm font-medium text-zinc-700 transition-colors hover:bg-zinc-100 disabled:opacity-50 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
      >
        {pending ? "재스캔 중..." : "다시 스캔하기"}
      </button>
    </form>
  );
}
