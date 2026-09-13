import { NextResponse } from "next/server";
import { getCurrentSellerId } from "@/lib/session";
import {
  canAccessProposalThread,
  createToolProposalMessage,
  listToolProposalMessages,
} from "@/lib/data";

const CONTENT_MAX_LENGTH = 1000;

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ proposalId: string }> }
) {
  const sellerId = await getCurrentSellerId();
  if (!sellerId) {
    return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });
  }

  const { proposalId } = await params;
  const canAccess = await canAccessProposalThread(proposalId, sellerId);
  if (!canAccess) {
    return NextResponse.json({ error: "권한이 없습니다." }, { status: 403 });
  }

  const messages = await listToolProposalMessages(proposalId);
  return NextResponse.json({ messages });
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ proposalId: string }> }
) {
  const sellerId = await getCurrentSellerId();
  if (!sellerId) {
    return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });
  }

  const { proposalId } = await params;
  const canAccess = await canAccessProposalThread(proposalId, sellerId);
  if (!canAccess) {
    return NextResponse.json({ error: "권한이 없습니다." }, { status: 403 });
  }

  const body = await request.json().catch(() => null);
  const content = typeof body?.content === "string" ? body.content.trim() : "";

  if (!content) {
    return NextResponse.json({ error: "메시지 내용을 입력해주세요." }, { status: 400 });
  }
  if (content.length > CONTENT_MAX_LENGTH) {
    return NextResponse.json(
      { error: `메시지는 ${CONTENT_MAX_LENGTH}자 이하로 입력해주세요.` },
      { status: 400 }
    );
  }

  const message = await createToolProposalMessage({
    proposalId,
    senderSellerId: sellerId,
    content,
  });

  return NextResponse.json({ id: message.id }, { status: 201 });
}
