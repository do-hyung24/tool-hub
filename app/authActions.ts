"use server";

import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { AuthError } from "next-auth";
import { AccountDeletionPendingError, signIn, signOut } from "@/lib/auth";
import { getCurrentSellerId } from "@/lib/session";
import {
  clearRateLimit,
  createPasswordResetToken,
  createResendVerificationToken,
  createSeller,
  getSellerByEmail,
  getSellerById,
  getSellerByNickname,
  isRateLimited,
  recordRateLimitFailure,
  requestAccountDeletion,
  resetPasswordWithToken,
  verifyEmailCode,
  type RateLimitConfig,
} from "@/lib/data";
import { hashPassword } from "@/lib/password";
import { sendPasswordResetEmail, sendVerificationEmail } from "@/lib/email";
import { SUPPORT_EMAIL } from "@/lib/constants";
import { safeNextPath } from "@/lib/safeNext";
import { validateNickname } from "@/lib/nickname";

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

async function getOrigin(): Promise<string> {
  const headerList = await headers();
  const host = headerList.get("host") ?? "localhost:3000";
  const proto =
    headerList.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https");
  return `${proto}://${host}`;
}

// x-forwarded-for는 클라이언트가 직접 보낼 수 있는 값이라(첫 값을 그대로
// 쓰면 매 요청마다 다른 값을 넣어 IP 카운터를 무력화할 수 있다) 그것만으로는
// 신뢰할 수 없다. x-vercel-forwarded-for는 Vercel 엣지가 직접 설정하는
// 값으로, 실측 결과 클라이언트가 같은 이름으로 헤더를 덮어써 보내도 무시되고
// 실제 접속 IP로 기록된다(아래 검증 결과 참고) - 이 값을 우선 사용한다.
// Vercel 밖(로컬 개발 등)에서는 이 헤더가 없으므로 x-forwarded-for로
// 대체하고, 그마저 없으면 "unknown"으로 뭉뚱그려 그 경로 전체가 하나의
// 버킷으로 제한받게 둔다(과도하게 막히지도, 무제한도 아니게).
async function getClientIp(): Promise<string> {
  const headerList = await headers();
  const vercelForwardedFor = headerList.get("x-vercel-forwarded-for");
  if (vercelForwardedFor) {
    const first = vercelForwardedFor.split(",")[0]?.trim();
    if (first) return first;
  }
  const forwardedFor = headerList.get("x-forwarded-for");
  if (forwardedFor) {
    const first = forwardedFor.split(",")[0]?.trim();
    if (first) return first;
  }
  return headerList.get("x-real-ip") ?? "unknown";
}

const RATE_LIMIT_MESSAGE = "시도가 너무 많습니다. 잠시 후 다시 시도해주세요.";

// 계정(이메일) 기준 - 15분 안에 5회 실패하면 15분 잠금. 이메일 인증 코드의
// 기존 임계값(MAX_CODE_ATTEMPTS=5)과 15분 창(VERIFICATION_TTL_MS)을 그대로
// 따른다. 정상 사용자가 비밀번호를 몇 번 오타내는 정도로는 걸리지 않는
// 수준이면서(실사용자는 보통 1~3회 안에 성공하거나 재설정으로 전환함),
// 공격자에게는 시간당 최대 20회로 무차별 대입을 사실상 무력화하는 값이다.
const LOGIN_EMAIL_LIMIT: RateLimitConfig = {
  windowMs: 15 * 60 * 1000,
  maxAttempts: 5,
  lockoutMs: 15 * 60 * 1000,
};

// IP 기준 - 계정 단위보다 훨씬 느슨하게 잡는다(20회/15분). 사무실·학교처럼
// 여러 사용자가 같은 공인 IP를 공유하는 경우 정상 사용자들이 함께 잠기는
// 부작용을 피하기 위함이다. 그래도 한 IP가 여러 계정을 순회하며 시도하는
// 크리덴셜 스터핑은 계정당 임계값보다 낮은 시도로도 결국 이 임계값에
// 걸린다.
const LOGIN_IP_LIMIT: RateLimitConfig = {
  windowMs: 15 * 60 * 1000,
  maxAttempts: 20,
  lockoutMs: 15 * 60 * 1000,
};

// 회원가입은 "추측"이 아니라 "대량 생성"이 문제라 IP 기준만 둔다. 1시간에
// 8회로, 셋 이상이 한 IP를 공유해도 정상적인 가입 흐름은 막히지 않을
// 정도로 넉넉하게 잡았다.
const SIGNUP_IP_LIMIT: RateLimitConfig = {
  windowMs: 60 * 60 * 1000,
  maxAttempts: 8,
  lockoutMs: 60 * 60 * 1000,
};

// 비밀번호 재설정은 "같은 이메일로 반복 발송"만 막으면 된다(계정 존재
// 여부와 무관하게 항상 같은 응답을 주는 기존 동작은 그대로 둔다). 1시간에
// 3회까지 - 한 번 깜빡한 사용자가 재요청하는 정도는 걸리지 않으면서, 같은
// 주소로 이메일을 계속 퍼붓는 남용은 막는다.
const RESET_EMAIL_LIMIT: RateLimitConfig = {
  windowMs: 60 * 60 * 1000,
  maxAttempts: 3,
  lockoutMs: 60 * 60 * 1000,
};

// 회원가입 폼의 "중복확인" 버튼에서 호출한다. 제출 전에 미리 확인만 할 뿐,
// signupAction의 최종 검증(아래)을 대체하지 않는다 - 클라이언트 체크를
// 우회해도 서버에서 다시 막힌다.
export type AvailabilityResult =
  | { status: "available" }
  | { status: "taken" }
  | { status: "invalid"; message: string };

export async function checkEmailAvailabilityAction(
  rawEmail: string
): Promise<AvailabilityResult> {
  const email = rawEmail.trim().toLowerCase();
  if (!EMAIL_REGEX.test(email)) {
    return { status: "invalid", message: "올바른 이메일 형식이 아닙니다." };
  }
  const existing = await getSellerByEmail(email);
  return existing ? { status: "taken" } : { status: "available" };
}

export async function checkNicknameAvailabilityAction(
  rawNickname: string
): Promise<AvailabilityResult> {
  const nickname = rawNickname.trim();
  if (!nickname) {
    return { status: "invalid", message: "닉네임을 입력해주세요." };
  }
  const validation = validateNickname(nickname);
  if (!validation.valid) {
    return { status: "invalid", message: validation.message };
  }
  const existing = await getSellerByNickname(nickname);
  return existing ? { status: "taken" } : { status: "available" };
}

// loginAction과 같은 패턴(useActionState) - 유효성 검증 실패는 서버 오류(throw→500)가
// 아니라 사용자에게 보여줄 메시지이므로 반환값으로 전달한다.
export type SignupState = { error?: string };

export async function signupAction(
  _prevState: SignupState,
  formData: FormData
): Promise<SignupState> {
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const password = String(formData.get("password") ?? "");
  const nickname = String(formData.get("nickname") ?? "").trim();
  const redirectTo = safeNextPath(formData.get("next"));

  // 계정 생성 "대량 발생"을 막는 IP 기준 게이트 - 성공/실패와 무관하게 시도
  // 자체를 센다(검증 실패로 끝나는 시도도 자동화된 계정 생성 시도의 일부일 수
  // 있어서다).
  const ipKey = `signup_ip:${await getClientIp()}`;
  const ipLimit = await isRateLimited(ipKey);
  if (ipLimit.locked) {
    return { error: RATE_LIMIT_MESSAGE };
  }
  await recordRateLimitFailure(ipKey, SIGNUP_IP_LIMIT);

  if (!EMAIL_REGEX.test(email)) {
    return { error: "올바른 이메일 주소를 입력해주세요." };
  }
  if (password.length < 8) {
    return { error: "비밀번호는 8자 이상이어야 합니다." };
  }
  if (!nickname) {
    return { error: "닉네임을 입력해주세요." };
  }
  const nicknameValidation = validateNickname(nickname);
  if (!nicknameValidation.valid) {
    return { error: nicknameValidation.message };
  }
  const agreedToPrivacy = formData.get("agreedToPrivacy") === "on";
  if (!agreedToPrivacy) {
    return { error: "개인정보처리방침에 동의해야 가입할 수 있습니다." };
  }

  const existingEmail = await getSellerByEmail(email);
  if (existingEmail) {
    return { error: "이미 가입된 이메일입니다." };
  }
  const existingNickname = await getSellerByNickname(nickname);
  if (existingNickname) {
    return { error: "이미 사용 중인 닉네임입니다." };
  }

  const passwordHash = await hashPassword(password);

  try {
    await createSeller({ email, passwordHash, nickname });
  } catch {
    return { error: "이미 가입된 이메일이거나 닉네임이거나, 계정을 만들지 못했습니다." };
  }

  // 미인증 계정도 로그인은 가능하므로, 가입 직후 바로 로그인 상태로 전환한다.
  // 인증 코드 발송은 이제 /verify-email 페이지의 버튼 클릭으로만 시작된다
  // (resendVerificationAction 참고). signIn은 성공 시 redirect 신호를 던지므로
  // 아래 return은 이론상 도달하지 않지만(타입상 필요), 실패해도 AuthError를
  // 던질 뿐이라 이 함수가 그대로 처리하지 않고 상위로 전파된다 - 방금 만든
  // 계정의 비밀번호가 그대로 넘어가므로 로그인 실패 자체가 발생할 일이 없다.
  await signIn("credentials", { email, password, redirectTo });
  return {};
}

export type LoginState = { error?: string };

export async function loginAction(
  _prevState: LoginState,
  formData: FormData
): Promise<LoginState> {
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const password = String(formData.get("password") ?? "");
  const redirectTo = safeNextPath(formData.get("next"));

  // 계정(이메일) 기준과 IP 기준을 함께 본다 - 계정 기준은 "이 계정을 노리는
  // 무차별 대입"을, IP 기준은 "한 곳에서 여러 계정을 순회하는 크리덴셜
  // 스터핑"을 막는다. 둘 중 하나라도 잠겨 있으면 같은 문구로만 응답해
  // 이메일 존재 여부(계정 잠금 vs IP 잠금)를 구분할 수 없게 한다.
  const emailKey = `login_email:${email}`;
  const ipKey = `login_ip:${await getClientIp()}`;
  const [emailLimit, ipLimit] = await Promise.all([isRateLimited(emailKey), isRateLimited(ipKey)]);
  if (emailLimit.locked || ipLimit.locked) {
    return { error: RATE_LIMIT_MESSAGE };
  }

  try {
    await signIn("credentials", { email, password, redirectTo });
  } catch (error) {
    if (error instanceof AccountDeletionPendingError) {
      await Promise.all([
        recordRateLimitFailure(emailKey, LOGIN_EMAIL_LIMIT),
        recordRateLimitFailure(ipKey, LOGIN_IP_LIMIT),
      ]);
      return {
        error: `탈퇴 처리 중인 계정입니다. 복구를 원하시면 ${SUPPORT_EMAIL}으로 문의해주세요.`,
      };
    }
    if (error instanceof AuthError) {
      await Promise.all([
        recordRateLimitFailure(emailKey, LOGIN_EMAIL_LIMIT),
        recordRateLimitFailure(ipKey, LOGIN_IP_LIMIT),
      ]);
      return { error: "이메일 또는 비밀번호가 올바르지 않습니다." };
    }
    // AuthError가 아닌 이 지점은 성공 시 signIn이 내부적으로 던지는 리다이렉트
    // 신호다(redirectTo로 이동) - 로그인에 성공했으므로 이 계정의 실패
    // 카운터만 지운다(IP 카운터는 그대로 둔다 - 같은 IP에서 다른 계정을 노리는
    // 시도가 진행 중일 수 있어서, 성공 하나로 IP 전체를 풀어주면 안 된다).
    await clearRateLimit(emailKey);
    throw error;
  }
  return {};
}

export async function logoutAction() {
  await signOut({ redirectTo: "/" });
}

// 탈퇴를 접수하고, 세션을 즉시 만료시킨 뒤 안내 메시지와 함께 로그인 화면으로 보낸다.
export async function requestAccountDeletionAction() {
  const sellerId = await getCurrentSellerId();
  if (!sellerId) {
    redirect("/login?next=/account/delete");
  }

  await requestAccountDeletion(sellerId);
  await signOut({ redirectTo: "/login?accountDeleted=1" });
}

export async function resendVerificationAction() {
  const sellerId = await getCurrentSellerId();
  if (!sellerId) {
    redirect("/login?next=/verify-email");
  }

  const seller = await getSellerById(sellerId);
  if (!seller || !seller.email) {
    throw new Error("계정 정보를 확인할 수 없습니다.");
  }
  if (seller.emailVerified) {
    redirect("/");
  }

  const result = await createResendVerificationToken(seller.id);
  if (result.status === "rate_limited") {
    redirect("/verify-email?resendError=cooldown");
  }

  const origin = await getOrigin();
  await sendVerificationEmail(
    seller.email,
    result.code,
    `${origin}/api/verify-email?token=${result.token}`
  );

  redirect("/verify-email?sent=1");
}

export async function verifyEmailCodeAction(formData: FormData) {
  const sellerId = await getCurrentSellerId();
  if (!sellerId) {
    redirect("/login?next=/verify-email");
  }

  const code = String(formData.get("code") ?? "").trim();
  if (!/^\d{6}$/.test(code)) {
    redirect("/verify-email?codeError=invalid");
  }

  const result = await verifyEmailCode(sellerId, code);

  if (result === "ok") {
    redirect("/verify-email?verified=1");
  }

  redirect(`/verify-email?codeError=${result}`);
}

export type ForgotPasswordState = { submitted?: boolean };

// 계정 존재 여부와 무관하게 항상 같은 결과를 반환한다 - 응답 차이로 계정
// 존재 여부를 유추하지 못하게 하기 위함이다 (사용자 열거 공격 방지).
export async function forgotPasswordAction(
  _prevState: ForgotPasswordState,
  formData: FormData
): Promise<ForgotPasswordState> {
  const email = String(formData.get("email") ?? "").trim().toLowerCase();

  // 잠겨 있으면(같은 이메일로 이미 여러 번 요청됨) 계정 존재 여부 확인도,
  // 메일 발송도, 카운터 기록도 전부 건너뛴다 - 응답은 잠금 여부와 무관하게
  // 항상 동일하다(아래 return 한 곳뿐이라 자연히 지켜진다).
  const emailKey = `reset_email:${email}`;
  const limit = await isRateLimited(emailKey);
  if (!limit.locked) {
    const seller = await getSellerByEmail(email);
    if (seller && seller.email) {
      const token = await createPasswordResetToken(seller.id);
      const origin = await getOrigin();
      await sendPasswordResetEmail(seller.email, `${origin}/reset-password?token=${token}`);
    }
    await recordRateLimitFailure(emailKey, RESET_EMAIL_LIMIT);
  }

  return { submitted: true };
}

export type ResetPasswordState = { error?: string };

const RESET_ERROR_MESSAGES: Record<string, string> = {
  not_found: "유효하지 않은 재설정 링크입니다. 다시 요청해주세요.",
  expired: "재설정 링크가 만료되었습니다. 다시 요청해주세요.",
  used: "이미 사용된 재설정 링크입니다. 다시 요청해주세요.",
};

export async function resetPasswordAction(
  _prevState: ResetPasswordState,
  formData: FormData
): Promise<ResetPasswordState> {
  const token = String(formData.get("token") ?? "");
  const password = String(formData.get("password") ?? "");
  const passwordConfirm = String(formData.get("passwordConfirm") ?? "");

  if (!token) {
    return { error: "재설정 링크가 올바르지 않습니다. 다시 요청해주세요." };
  }
  if (password.length < 8) {
    return { error: "비밀번호는 8자 이상이어야 합니다." };
  }
  if (password !== passwordConfirm) {
    return { error: "비밀번호가 일치하지 않습니다." };
  }

  const passwordHash = await hashPassword(password);
  const result = await resetPasswordWithToken(token, passwordHash);

  if (result === "ok") {
    redirect("/login?resetSuccess=1");
  }

  return { error: RESET_ERROR_MESSAGES[result] ?? "비밀번호 재설정에 실패했습니다. 다시 시도해주세요." };
}
