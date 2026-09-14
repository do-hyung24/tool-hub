// 닉네임 형식 규칙 - 회원가입 클라이언트(SignupForm)와 서버(authActions)가
// 이 파일을 함께 참조해 같은 기준으로 검증한다("use server" 파일은 함수만
// export할 수 있어 상수를 공유하려면 별도 파일이 필요하다).
//
// 기준 근거:
// - 길이 2~20자: 1자는 식별력이 없고(공백/특수문자로 채운 "이름"도 통과되던
//   기존 문제), 너무 길면 카드/배지/댓글/"OO님" 표기처럼 폭이 좁은 UI에서
//   레이아웃이 깨진다. 20자는 한글 기준 화면에 무리 없이 들어가는 선.
// - 한글 음절 + 영문 + 숫자 + '_' '-'만 허용: 공백을 막아 트리밍/중복 공백
//   문제를 원천 차단하고, 이모지·제어문자·기타 특수문자를 막아 좁은 UI에서의
//   표시 깨짐과 XSS성 문자열 삽입을 함께 방어한다(이메일 템플릿 escapeHtml과는
//   별개의 추가 방어선). 완성되지 않은 자모(ㄱ-ㅎ, ㅏ-ㅣ) 단독 입력은 제외해
//   음절 단위로만 받는다.
export const NICKNAME_MIN_LENGTH = 2;
export const NICKNAME_MAX_LENGTH = 20;
export const NICKNAME_PATTERN = /^[가-힣a-zA-Z0-9_-]+$/;

export type NicknameValidation = { valid: true } | { valid: false; message: string };

export function validateNickname(raw: string): NicknameValidation {
  const nickname = raw.trim();
  if (nickname.length < NICKNAME_MIN_LENGTH || nickname.length > NICKNAME_MAX_LENGTH) {
    return {
      valid: false,
      message: `닉네임은 ${NICKNAME_MIN_LENGTH}~${NICKNAME_MAX_LENGTH}자로 입력해주세요.`,
    };
  }
  if (!NICKNAME_PATTERN.test(nickname)) {
    return {
      valid: false,
      message: "닉네임은 한글, 영문, 숫자, '_', '-'만 사용할 수 있습니다(공백·특수문자 불가).",
    };
  }
  return { valid: true };
}
