import "server-only";

// 의뢰 본문에 실수로 적힌 제3자 개인정보를 가린다. 목적은 실수 방지이지
// 작정한 우회 차단이 아니다 - 오탐 가능성이 낮은 패턴만 저장 시점에 조용히
// 치환하고(원문은 어디에도 남기지 않는다), 애매한 것은 경고만 띄운다(저장은
// 원문 그대로). lib/scan.ts(완성본 보안 스캔)와는 목적·대상이 달라 섞지 않는다.

const RRN_PATTERN = /\b\d{6}-\d{7}\b/g;
const EMAIL_PATTERN = /[\w.+-]+@[\w-]+\.[a-zA-Z]{2,}/g;
const MOBILE_PATTERN = /\b01[016789][-.\s]?\d{3,4}[-.\s]?\d{4}\b/g;
const LANDLINE_PATTERN = /\b0(2|[3-6][1-4])[-.\s]?\d{3,4}[-.\s]?\d{4}\b/g;
const LONG_DIGIT_RUN_PATTERN = /\d{10,}/g;

export type MaskResult = {
  text: string;
  maskedCount: number;
};

// 저장 시점에 확실한 패턴만 조용히 치환한다. 순서가 중요하다 - 주민등록번호를
// 가장 먼저 처리해야, 뒤이은 전화번호 정규식이 그 안의 숫자 일부만 잘못
// 가로채 가는 것을 막을 수 있다. 연속 10자리 숫자(계좌 등)는 가장 마지막에
// 처리해, 이미 치환된 자리(대괄호 라벨)를 다시 건드리지 않는다.
export function maskPersonalInfo(input: string): MaskResult {
  let maskedCount = 0;
  let text = input;

  text = text.replace(RRN_PATTERN, () => {
    maskedCount++;
    return "[개인정보 비공개]";
  });
  text = text.replace(EMAIL_PATTERN, () => {
    maskedCount++;
    return "[이메일 비공개]";
  });
  text = text.replace(MOBILE_PATTERN, () => {
    maskedCount++;
    return "[연락처 비공개]";
  });
  text = text.replace(LANDLINE_PATTERN, () => {
    maskedCount++;
    return "[연락처 비공개]";
  });
  text = text.replace(LONG_DIGIT_RUN_PATTERN, () => {
    maskedCount++;
    return "[계좌 비공개]";
  });

  return { text, maskedCount };
}

// ---- 경고 전용(치환하지 않음) ----
// 한글 수사·한자·전각·영문 대체 문자로 흩어 적은 전화번호 등을 정규화했을 때
// 8자리 이상 연속 숫자가 되는 구간을 찾아, 저장은 그대로 하되 경고만 띄운다.
// "일이삼사 순서로 정렬" 같은 정상 문장은 8자리에 못 미쳐 자연히 걸러진다.

const KOREAN_DIGIT_MAP: Record<string, true> = {
  공: true, 영: true, 일: true, 이: true, 삼: true, 사: true,
  오: true, 육: true, 륙: true, 칠: true, 팔: true, 구: true,
};

const HANJA_DIGIT_MAP: Record<string, true> = {
  一: true, 二: true, 三: true, 四: true, 五: true,
  六: true, 七: true, 八: true, 九: true, 十: true, 零: true,
};

const SEPARATOR_CHARS = new Set([" ", "-", ".", "_", "(", ")"]);
const LETTER_PATTERN = /[a-zA-Z]/;

function isFullwidthDigit(ch: string): boolean {
  const code = ch.codePointAt(0);
  return code !== undefined && code >= 0xff10 && code <= 0xff19;
}

// o/O, l/I는 숫자 대체 문자로 흔히 쓰이지만, 앞뒤가 모두 영문자면("hello")
// 단어의 일부이지 숫자가 아니다.
function isLetterSubstituteDigit(text: string, index: number): boolean {
  const ch = text[index];
  if (ch !== "o" && ch !== "O" && ch !== "l" && ch !== "I") return false;
  const before = text[index - 1];
  const after = text[index + 1];
  const bothLetters = LETTER_PATTERN.test(before ?? "") && LETTER_PATTERN.test(after ?? "");
  return !bothLetters;
}

type CharKind = "digit" | "separator" | "other";

function classifyChar(text: string, index: number): CharKind {
  const ch = text[index];
  if (ch >= "0" && ch <= "9") return "digit";
  if (SEPARATOR_CHARS.has(ch)) return "separator";
  if (isFullwidthDigit(ch)) return "digit";
  if (ch in KOREAN_DIGIT_MAP) return "digit";
  if (ch in HANJA_DIGIT_MAP) return "digit";
  if (isLetterSubstituteDigit(text, index)) return "digit";
  return "other";
}

const WARNING_DIGIT_THRESHOLD = 8;

// 정규화 시 8자리 이상 연속 숫자로 보이는 구간을 원문 그대로 인용해 반환한다.
// 반환값은 경고 문구에만 쓰이고 저장되는 텍스트에는 영향을 주지 않는다.
export function findObfuscatedDigitRuns(text: string): string[] {
  const warnings: string[] = [];
  let runLength = 0;
  let runStart = -1;

  for (let i = 0; i < text.length; i++) {
    const kind = classifyChar(text, i);
    if (kind === "digit") {
      if (runLength === 0) runStart = i;
      runLength++;
    } else if (kind === "separator") {
      // 런 중간의 구분자는 통과시킨다(런이 아직 시작 안 됐으면 그냥 무시).
      continue;
    } else {
      if (runLength >= WARNING_DIGIT_THRESHOLD) {
        warnings.push(text.slice(runStart, i));
      }
      runLength = 0;
      runStart = -1;
    }
  }
  if (runLength >= WARNING_DIGIT_THRESHOLD) {
    warnings.push(text.slice(runStart, text.length));
  }
  return warnings;
}
