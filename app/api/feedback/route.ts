import { NextResponse } from "next/server";
import { getCurrentSellerId } from "@/lib/session";
import { createFeedbackVoice, getLatestFeedbackVoice, getSellerById } from "@/lib/data";
import { sendFeedbackNotificationEmail } from "@/lib/email";
import { FEEDBACK_CATEGORIES, type FeedbackCategory } from "@/lib/types";

const MESSAGE_MIN_LENGTH = 5;
const MESSAGE_MAX_LENGTH = 2000;
const RESUBMIT_COOLDOWN_MS = 60 * 1000;

function isFeedbackCategory(value: unknown): value is FeedbackCategory {
  return typeof value === "string" && (FEEDBACK_CATEGORIES as readonly string[]).includes(value);
}

export async function POST(request: Request) {
  const sellerId = await getCurrentSellerId();
  if (!sellerId) {
    return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const category = body?.category;
  const message = typeof body?.message === "string" ? body.message.trim() : "";

  if (!isFeedbackCategory(category)) {
    return NextResponse.json({ error: "올바른 카테고리를 선택해주세요." }, { status: 400 });
  }
  if (message.length < MESSAGE_MIN_LENGTH || message.length > MESSAGE_MAX_LENGTH) {
    return NextResponse.json(
      { error: `내용은 ${MESSAGE_MIN_LENGTH}자 이상 ${MESSAGE_MAX_LENGTH}자 이하로 입력해주세요.` },
      { status: 400 }
    );
  }

  const latest = await getLatestFeedbackVoice(sellerId);
  if (latest && Date.now() - new Date(latest.createdAt).getTime() < RESUBMIT_COOLDOWN_MS) {
    return NextResponse.json(
      { error: "잠시 후 다시 시도해주세요. (60초당 1회로 제한됩니다)" },
      { status: 429 }
    );
  }

  await createFeedbackVoice({ sellerId, category, message });

  const seller = await getSellerById(sellerId);
  await sendFeedbackNotificationEmail({
    nickname: seller?.nickname ?? "알 수 없음",
    category,
    message,
  });

  return NextResponse.json({ ok: true }, { status: 201 });
}
