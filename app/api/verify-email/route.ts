import { NextResponse } from "next/server";
import { consumeEmailVerificationToken } from "@/lib/data";

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const token = searchParams.get("token");

  if (!token) {
    return NextResponse.redirect(new URL("/verify-email?error=1", origin));
  }

  const sellerId = await consumeEmailVerificationToken(token);
  if (!sellerId) {
    return NextResponse.redirect(new URL("/verify-email?error=1", origin));
  }

  return NextResponse.redirect(new URL("/verify-email?verified=1", origin));
}
