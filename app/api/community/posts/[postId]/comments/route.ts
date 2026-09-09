import { NextResponse } from "next/server";
import { getCurrentSellerId } from "@/lib/session";
import { createCommunityComment, getCommunityPostById } from "@/lib/data";

const CONTENT_MAX_LENGTH = 1000;

export async function POST(
  request: Request,
  { params }: { params: Promise<{ postId: string }> }
) {
  const sellerId = await getCurrentSellerId();
  if (!sellerId) {
    return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });
  }

  const { postId } = await params;
  const post = await getCommunityPostById(postId);
  if (!post || post.hidden) {
    return NextResponse.json({ error: "게시글을 찾을 수 없습니다." }, { status: 404 });
  }

  const body = await request.json().catch(() => null);
  const content = typeof body?.content === "string" ? body.content.trim() : "";

  if (!content) {
    return NextResponse.json({ error: "댓글 내용을 입력해주세요." }, { status: 400 });
  }
  if (content.length > CONTENT_MAX_LENGTH) {
    return NextResponse.json(
      { error: `댓글은 ${CONTENT_MAX_LENGTH}자 이하로 입력해주세요.` },
      { status: 400 }
    );
  }

  const comment = await createCommunityComment({ postId, authorSellerId: sellerId, content });

  return NextResponse.json({ id: comment.id }, { status: 201 });
}
