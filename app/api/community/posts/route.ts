import { NextResponse } from "next/server";
import { getCurrentSellerId } from "@/lib/session";
import { createCommunityPost, isOperatorSeller } from "@/lib/data";
import { COMMUNITY_CATEGORIES, type CommunityCategory } from "@/lib/types";

const TITLE_MIN_LENGTH = 2;
const TITLE_MAX_LENGTH = 100;
const CONTENT_MIN_LENGTH = 5;
const CONTENT_MAX_LENGTH = 5000;

function isCommunityCategory(value: unknown): value is CommunityCategory {
  return typeof value === "string" && (COMMUNITY_CATEGORIES as readonly string[]).includes(value);
}

export async function POST(request: Request) {
  const sellerId = await getCurrentSellerId();
  if (!sellerId) {
    return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const category = body?.category;
  const title = typeof body?.title === "string" ? body.title.trim() : "";
  const content = typeof body?.content === "string" ? body.content.trim() : "";

  if (!isCommunityCategory(category)) {
    return NextResponse.json({ error: "올바른 카테고리를 선택해주세요." }, { status: 400 });
  }
  if (category === "공지" && !(await isOperatorSeller(sellerId))) {
    return NextResponse.json({ error: "공지는 운영자만 작성할 수 있습니다." }, { status: 400 });
  }
  if (title.length < TITLE_MIN_LENGTH || title.length > TITLE_MAX_LENGTH) {
    return NextResponse.json(
      { error: `제목은 ${TITLE_MIN_LENGTH}자 이상 ${TITLE_MAX_LENGTH}자 이하로 입력해주세요.` },
      { status: 400 }
    );
  }
  if (content.length < CONTENT_MIN_LENGTH || content.length > CONTENT_MAX_LENGTH) {
    return NextResponse.json(
      { error: `내용은 ${CONTENT_MIN_LENGTH}자 이상 ${CONTENT_MAX_LENGTH}자 이하로 입력해주세요.` },
      { status: 400 }
    );
  }

  const post = await createCommunityPost({ authorSellerId: sellerId, category, title, content });

  return NextResponse.json({ id: post.id }, { status: 201 });
}
