"use client";

import Link from "next/link";
import { useRef, useState, useTransition } from "react";
import {
  checkEmailAvailabilityAction,
  checkNicknameAvailabilityAction,
  signupAction,
} from "@/app/authActions";

type CheckStatus = "unchecked" | "checking" | "available" | "taken" | "invalid" | "stale";

function StatusMessage({
  status,
  availableText,
  takenText,
  invalidMessage,
}: {
  status: CheckStatus;
  availableText: string;
  takenText: string;
  invalidMessage: string | null;
}) {
  if (status === "checking") {
    return <p className="text-xs text-zinc-400 dark:text-zinc-500">확인 중...</p>;
  }
  if (status === "available") {
    return (
      <p className="text-xs font-medium text-emerald-600 dark:text-emerald-400">
        {availableText}
      </p>
    );
  }
  if (status === "taken") {
    return <p className="text-xs font-medium text-red-600 dark:text-red-400">{takenText}</p>;
  }
  if (status === "invalid") {
    return (
      <p className="text-xs font-medium text-red-600 dark:text-red-400">
        {invalidMessage}
      </p>
    );
  }
  if (status === "stale") {
    return (
      <p className="text-xs text-amber-600 dark:text-amber-400">
        값이 변경되었습니다. 다시 중복확인해주세요.
      </p>
    );
  }
  return null;
}

export function SignupForm({ next }: { next?: string }) {
  const [email, setEmail] = useState("");
  const [nickname, setNickname] = useState("");
  const [emailStatus, setEmailStatus] = useState<CheckStatus>("unchecked");
  const [nicknameStatus, setNicknameStatus] = useState<CheckStatus>("unchecked");
  const [emailInvalidMessage, setEmailInvalidMessage] = useState<string | null>(null);
  const [nicknameInvalidMessage, setNicknameInvalidMessage] = useState<string | null>(null);
  const [agreedToPrivacy, setAgreedToPrivacy] = useState(false);
  const [, startTransition] = useTransition();

  // 비동기 중복확인이 끝났을 때 "그 사이에 입력값이 바뀌었는지"를 판단하려면
  // 항상 최신 값을 담고 있는 ref가 필요하다. state(email/nickname)는 이 함수가
  // 생성된 시점의 렌더에 고정되어 있어, 클로저 안에서 비교해도 매번 자기
  // 자신과 비교하는 셈이 되어 값이 바뀐 것을 절대 감지하지 못한다. 렌더 중에는
  // ref를 갱신할 수 없으므로(react-hooks/refs), 변경 이벤트 핸들러에서 같이 갱신한다.
  const emailRef = useRef(email);
  const nicknameRef = useRef(nickname);

  function handleEmailChange(value: string) {
    emailRef.current = value;
    setEmail(value);
    setEmailStatus((prev) => (prev === "unchecked" ? "unchecked" : "stale"));
  }

  function handleNicknameChange(value: string) {
    nicknameRef.current = value;
    setNickname(value);
    setNicknameStatus((prev) => (prev === "unchecked" ? "unchecked" : "stale"));
  }

  function handleCheckEmail() {
    const value = email;
    setEmailStatus("checking");
    startTransition(async () => {
      const result = await checkEmailAvailabilityAction(value);
      if (value !== emailRef.current) return; // 확인하는 동안 값이 또 바뀌었으면 결과를 버린다.
      setEmailInvalidMessage(result.status === "invalid" ? result.message : null);
      setEmailStatus(result.status);
    });
  }

  function handleCheckNickname() {
    const value = nickname;
    setNicknameStatus("checking");
    startTransition(async () => {
      const result = await checkNicknameAvailabilityAction(value);
      if (value !== nicknameRef.current) return;
      setNicknameInvalidMessage(result.status === "invalid" ? result.message : null);
      setNicknameStatus(result.status);
    });
  }

  const canSubmit =
    emailStatus === "available" && nicknameStatus === "available" && agreedToPrivacy;

  return (
    <form action={signupAction} className="mt-8 flex flex-col gap-6">
      <input type="hidden" name="next" value={next ?? ""} />
      <div className="flex flex-col gap-1.5">
        <label htmlFor="email" className="text-sm font-medium">
          이메일
        </label>
        <div className="flex gap-2">
          <input
            id="email"
            name="email"
            type="email"
            required
            autoComplete="email"
            placeholder="you@example.com"
            value={email}
            onChange={(event) => handleEmailChange(event.target.value)}
            className="flex-1 rounded-lg border border-zinc-300 px-3 py-2 text-sm outline-none focus:border-zinc-500 dark:border-zinc-700 dark:bg-zinc-900"
          />
          <button
            type="button"
            onClick={handleCheckEmail}
            disabled={!email || emailStatus === "checking"}
            className="shrink-0 rounded-lg border border-zinc-300 px-3 py-2 text-sm font-medium text-zinc-700 transition-colors hover:bg-zinc-100 disabled:cursor-not-allowed disabled:opacity-50 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
          >
            중복확인
          </button>
        </div>
        <StatusMessage
          status={emailStatus}
          availableText="사용 가능한 이메일입니다"
          takenText="이미 가입된 이메일입니다"
          invalidMessage={emailInvalidMessage}
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <label htmlFor="nickname" className="text-sm font-medium">
          닉네임
        </label>
        <div className="flex gap-2">
          <input
            id="nickname"
            name="nickname"
            type="text"
            required
            placeholder="봇공작소"
            value={nickname}
            onChange={(event) => handleNicknameChange(event.target.value)}
            className="flex-1 rounded-lg border border-zinc-300 px-3 py-2 text-sm outline-none focus:border-zinc-500 dark:border-zinc-700 dark:bg-zinc-900"
          />
          <button
            type="button"
            onClick={handleCheckNickname}
            disabled={!nickname || nicknameStatus === "checking"}
            className="shrink-0 rounded-lg border border-zinc-300 px-3 py-2 text-sm font-medium text-zinc-700 transition-colors hover:bg-zinc-100 disabled:cursor-not-allowed disabled:opacity-50 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
          >
            중복확인
          </button>
        </div>
        <StatusMessage
          status={nicknameStatus}
          availableText="사용 가능한 닉네임입니다"
          takenText="이미 사용 중인 닉네임입니다"
          invalidMessage={nicknameInvalidMessage}
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <label htmlFor="password" className="text-sm font-medium">
          비밀번호
        </label>
        <input
          id="password"
          name="password"
          type="password"
          required
          minLength={8}
          autoComplete="new-password"
          placeholder="8자 이상"
          className="rounded-lg border border-zinc-300 px-3 py-2 text-sm outline-none focus:border-zinc-500 dark:border-zinc-700 dark:bg-zinc-900"
        />
      </div>

      <div className="flex items-start gap-2">
        <input
          id="agreedToPrivacy"
          name="agreedToPrivacy"
          type="checkbox"
          checked={agreedToPrivacy}
          onChange={(event) => setAgreedToPrivacy(event.target.checked)}
          className="mt-0.5 h-4 w-4 rounded border-zinc-300 dark:border-zinc-700"
        />
        <label htmlFor="agreedToPrivacy" className="text-sm text-zinc-700 dark:text-zinc-300">
          <Link
            href="/privacy"
            target="_blank"
            className="font-medium text-zinc-900 underline dark:text-zinc-50"
          >
            개인정보처리방침
          </Link>
          에 동의합니다 (필수)
        </label>
      </div>

      <button
        type="submit"
        disabled={!canSubmit}
        className="mt-2 rounded-full bg-zinc-900 px-5 py-2.5 text-sm font-medium text-white transition-colors hover:bg-zinc-700 disabled:cursor-not-allowed disabled:opacity-40 dark:bg-zinc-50 dark:text-zinc-900 dark:hover:bg-zinc-200"
      >
        가입하기
      </button>
      {!canSubmit && (
        <p className="text-xs text-zinc-400 dark:text-zinc-500">
          이메일/닉네임 중복확인과 개인정보처리방침 동의를 모두 완료해야 가입할 수 있습니다.
        </p>
      )}
    </form>
  );
}
