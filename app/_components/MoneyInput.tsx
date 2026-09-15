"use client";

import { useRef } from "react";
import { formatAmountInput, parseAmountInput } from "@/lib/format";

// 금액 입력 전용 인풋 - type="number"의 스피너/휠 스크롤 문제를 피해
// type="text" + inputMode="numeric"을 쓰고, 콤마 표시 + "원" 고정 접미사를
// 붙인다. state는 항상 콤마 없는 숫자 문자열만 들고 있고(onChange로 그대로
// 넘김), 화면 표시만 이 컴포넌트 안에서 콤마를 붙인다.
//
// 커서 보존: 매 입력마다 문자열을 통째로 다시 포맷하므로, 가만히 두면 리액트가
// 커서를 끝으로 보내버린다. "커서 앞에 있던 숫자 개수"를 기준으로, 리포맷된
// 문자열에서 같은 위치를 다시 찾아 커서를 되돌린다.
export function MoneyInput({
  id,
  value,
  onChange,
  required,
  placeholder,
  className,
  autoFocus,
}: {
  id?: string;
  value: string;
  onChange: (rawDigits: string) => void;
  required?: boolean;
  placeholder?: string;
  className?: string;
  autoFocus?: boolean;
}) {
  const inputRef = useRef<HTMLInputElement>(null);

  function handleChange(event: React.ChangeEvent<HTMLInputElement>) {
    const input = event.target;
    const cursor = input.selectionStart ?? input.value.length;
    const digitsBeforeCursor = parseAmountInput(input.value.slice(0, cursor)).length;
    const nextRaw = parseAmountInput(input.value);
    onChange(nextRaw);

    requestAnimationFrame(() => {
      const el = inputRef.current;
      if (!el) return;
      const formatted = formatAmountInput(nextRaw);
      let seen = 0;
      let pos = formatted.length;
      for (let i = 0; i < formatted.length; i++) {
        if (seen === digitsBeforeCursor) {
          pos = i;
          break;
        }
        if (/[0-9]/.test(formatted[i])) seen++;
      }
      el.setSelectionRange(pos, pos);
    });
  }

  return (
    <div className="relative">
      <input
        ref={inputRef}
        id={id}
        type="text"
        inputMode="numeric"
        required={required}
        autoFocus={autoFocus}
        value={formatAmountInput(value)}
        onChange={handleChange}
        placeholder={placeholder}
        className={className}
      />
      <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-sm text-zinc-400 dark:text-zinc-500">
        원
      </span>
    </div>
  );
}
