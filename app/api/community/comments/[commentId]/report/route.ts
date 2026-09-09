import { NextResponse } from "next/server";
import { getCurrentSellerId } from "@/lib/session";
import { reportCommunityComment } from "@/lib/data";

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ commentId: string }> }
) {
  const sellerId = await getCurrentSellerId();
  if (!sellerId) {
    return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });
  }

  const { commentId } = await params;

  try {
    const result = await reportCommunityComment({ commentId, reporterSellerId: sellerId });
    if (result === "already_reported") {
      return NextResponse.json({ error: "이미 신고한 댓글입니다." }, { status: 409 });
    }
    return NextResponse.json({ ok: true }, { status: 201 });
  } catch {
    // 존재하지 않는 comment_id 등 FK 위반 시에도 이 경로로 온다.
    return NextResponse.json({ error: "댓글을 찾을 수 없습니다." }, { status: 404 });
  }
}
