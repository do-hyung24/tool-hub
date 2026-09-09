import { NextResponse } from "next/server";
import { getCurrentSellerId } from "@/lib/session";
import { getCommunityPostById, reportCommunityPost } from "@/lib/data";

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ postId: string }> }
) {
  const sellerId = await getCurrentSellerId();
  if (!sellerId) {
    return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });
  }

  const { postId } = await params;
  const post = await getCommunityPostById(postId);
  if (!post) {
    return NextResponse.json({ error: "게시글을 찾을 수 없습니다." }, { status: 404 });
  }

  const result = await reportCommunityPost({ postId, reporterSellerId: sellerId });
  if (result === "already_reported") {
    return NextResponse.json({ error: "이미 신고한 게시글입니다." }, { status: 409 });
  }

  return NextResponse.json({ ok: true }, { status: 201 });
}
