import "server-only";
import { Resend } from "resend";

// Resend에 도메인을 등록하기 전까지 쓸 수 있는 기본 발신 주소.
// 실제 도메인을 인증했다면 RESEND_FROM_EMAIL로 덮어쓸 수 있다.
const FROM_EMAIL = process.env.RESEND_FROM_EMAIL || "툴허브 <onboarding@resend.dev>";

export async function sendVerificationEmail(
  to: string,
  code: string,
  verifyUrl: string
): Promise<void> {
  const apiKey = process.env.RESEND_API_KEY;

  // RESEND_API_KEY가 아직 없으면(발급 전) 발송을 건너뛰고 콘솔에 코드/링크를 남긴다.
  // 개발 중에도 이메일 인증 플로우 자체는 막히지 않도록 하기 위함이다.
  if (!apiKey) {
    console.log(
      `[이메일 인증] RESEND_API_KEY가 설정되지 않아 실제 발송을 건너뜁니다.\n` +
        `  받는 사람: ${to}\n` +
        `  인증 코드: ${code} (15분간 유효)\n` +
        `  인증 링크: ${verifyUrl}`
    );
    return;
  }

  const resend = new Resend(apiKey);
  try {
    await resend.emails.send({
      from: FROM_EMAIL,
      to,
      subject: `[툴허브] 이메일 인증 코드: ${code}`,
      html:
        `<p>안녕하세요, 툴허브입니다.</p>` +
        `<p>아래 6자리 코드를 인증 화면에 입력해주세요 (15분 동안 유효).</p>` +
        `<p style="font-size:28px;font-weight:bold;letter-spacing:4px;">${code}</p>` +
        `<p>또는 아래 링크를 클릭해도 바로 인증됩니다.</p>` +
        `<p><a href="${verifyUrl}">${verifyUrl}</a></p>`,
      text:
        `인증 코드: ${code} (15분 동안 유효)\n` +
        `또는 아래 링크를 열어 인증을 완료해주세요:\n${verifyUrl}`,
    });
  } catch (error) {
    // 발송 실패해도 회원가입 자체는 막지 않는다 - 사용자는 재발송 버튼으로 다시 시도할 수 있다.
    console.error("[이메일 인증] Resend 발송 실패:", error);
  }
}
