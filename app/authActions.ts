"use server";

import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { AuthError } from "next-auth";
import { signIn, signOut } from "@/lib/auth";
import { getCurrentSellerId } from "@/lib/session";
import {
  createEmailVerificationToken,
  createSeller,
  getSellerByEmail,
  getSellerById,
  verifyEmailCode,
} from "@/lib/data";
import { hashPassword } from "@/lib/password";
import { sendVerificationEmail } from "@/lib/email";

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

async function getOrigin(): Promise<string> {
  const headerList = await headers();
  const host = headerList.get("host") ?? "localhost:3000";
  const proto =
    headerList.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https");
  return `${proto}://${host}`;
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

  const existing = await getSellerByEmail(email);
  if (existing) {
    throw new Error("이미 가입된 이메일입니다.");
  }

  const passwordHash = await hashPassword(password);

  let seller;
  try {
    seller = await createSeller({ email, passwordHash, nickname });
  } catch {
    throw new Error("이미 가입된 이메일이거나, 계정을 만들지 못했습니다.");
  }

  const { token, code } = await createEmailVerificationToken(seller.id);
  const origin = await getOrigin();
  await sendVerificationEmail(email, code, `${origin}/api/verify-email?token=${token}`);

  // 미인증 계정도 로그인은 가능하므로, 가입 직후 바로 로그인 상태로 전환한다.
  await signIn("credentials", { email, password, redirectTo: "/" });
}

export async function loginAction(formData: FormData) {
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const password = String(formData.get("password") ?? "");

  try {
    await signIn("credentials", { email, password, redirectTo: "/" });
  } catch (error) {
    if (error instanceof AuthError) {
      throw new Error("이메일 또는 비밀번호가 올바르지 않습니다.");
    }
    throw error;
  }
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
