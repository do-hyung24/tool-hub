"use server";

import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { AuthError } from "next-auth";
import { signIn, signOut } from "@/lib/auth";
import { getCurrentSellerId } from "@/lib/session";
import {
  createEmailVerificationToken,
  createPasswordResetToken,
  createSeller,
  getSellerByEmail,
  getSellerById,
  getSellerByNickname,
  resetPasswordWithToken,
  verifyEmailCode,
} from "@/lib/data";
import { hashPassword } from "@/lib/password";
import { sendPasswordResetEmail, sendVerificationEmail } from "@/lib/email";

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

async function getOrigin(): Promise<string> {
  const headerList = await headers();
  const host = headerList.get("host") ?? "localhost:3000";
  const proto =
    headerList.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https");
  return `${proto}://${host}`;
}

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
  const existing = await getSellerByNickname(nickname);
  return existing ? { status: "taken" } : { status: "available" };
}

export async function signupAction(formData: FormData) {
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const password = String(formData.get("password") ?? "");
  const nickname = String(formData.get("nickname") ?? "").trim();

  if (!EMAIL_REGEX.test(email)) {
    throw new Error("올바른 이메일 주소를 입력해주세요.");
  }
  if (password.length < 8) {
    throw new Error("비밀번호는 8자 이상이어야 합니다.");
  }
  if (!nickname) {
    throw new Error("닉네임을 입력해주세요.");
  }

  const existingEmail = await getSellerByEmail(email);
  if (existingEmail) {
    throw new Error("이미 가입된 이메일입니다.");
  }
  const existingNickname = await getSellerByNickname(nickname);
  if (existingNickname) {
    throw new Error("이미 사용 중인 닉네임입니다.");
  }

  const passwordHash = await hashPassword(password);

  let seller;
  try {
    seller = await createSeller({ email, passwordHash, nickname });
  } catch {
    throw new Error("이미 가입된 이메일이거나 닉네임이거나, 계정을 만들지 못했습니다.");
  }

  const { token, code } = await createEmailVerificationToken(seller.id);
  const origin = await getOrigin();
  await sendVerificationEmail(email, code, `${origin}/api/verify-email?token=${token}`);

  // 미인증 계정도 로그인은 가능하므로, 가입 직후 바로 로그인 상태로 전환한다.
  await signIn("credentials", { email, password, redirectTo: "/" });
}

export type LoginState = { error?: string };

export async function loginAction(
  _prevState: LoginState,
  formData: FormData
): Promise<LoginState> {
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const password = String(formData.get("password") ?? "");

  try {
    await signIn("credentials", { email, password, redirectTo: "/" });
  } catch (error) {
    if (error instanceof AuthError) {
      return { error: "이메일 또는 비밀번호가 올바르지 않습니다." };
    }
    throw error;
  }
  return {};
}

export async function logoutAction() {
  await signOut({ redirectTo: "/" });
}

export async function resendVerificationAction() {
  const sellerId = await getCurrentSellerId();
  if (!sellerId) {
    redirect("/login");
  }

  const seller = await getSellerById(sellerId);
  if (!seller || !seller.email) {
    throw new Error("계정 정보를 확인할 수 없습니다.");
  }
  if (seller.emailVerified) {
    redirect("/");
  }

  const { token, code } = await createEmailVerificationToken(seller.id);
  const origin = await getOrigin();
  await sendVerificationEmail(seller.email, code, `${origin}/api/verify-email?token=${token}`);

  redirect("/verify-email?sent=1");
}

export async function verifyEmailCodeAction(formData: FormData) {
  const sellerId = await getCurrentSellerId();
  if (!sellerId) {
    redirect("/login");
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

  const seller = await getSellerByEmail(email);
  if (seller && seller.email) {
    const token = await createPasswordResetToken(seller.id);
    const origin = await getOrigin();
    await sendPasswordResetEmail(seller.email, `${origin}/reset-password?token=${token}`);
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
