import { NextResponse } from "next/server";
import { getCurrentSellerId } from "@/lib/session";
import { getToolProposalById, getToolRequestById, selectToolProposal } from "@/lib/data";

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ requestId: string; proposalId: string }> }
) {
  const sellerId = await getCurrentSellerId();
  if (!sellerId) {
    return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });
  }

  const { requestId, proposalId } = await params;
  const toolRequest = await getToolRequestById(requestId);
  if (!toolRequest) {
    return NextResponse.json({ error: "의뢰를 찾을 수 없습니다." }, { status: 404 });
  }
  if (toolRequest.requesterSellerId !== sellerId) {
    return NextResponse.json({ error: "권한이 없습니다." }, { status: 403 });
  }

  // selectToolProposal의 두 번째 UPDATE는 `WHERE id=proposalId AND request_id=requestId`로
  // 스코프되어 있지만 반환값을 확인하지 않는다 - proposalId가 requestId 소속이 아니면
  // 첫 번째 UPDATE로 의뢰는 이미 'in_progress'로 바뀐 채 두 번째 UPDATE만 조용히
  // no-op된다. 여기서 미리 소속을 확인해 그 상태를 막는다.
  const proposal = await getToolProposalById(proposalId);
  if (!proposal || proposal.requestId !== requestId) {
    return NextResponse.json({ error: "잘못된 요청입니다." }, { status: 400 });
  }

  const selected = await selectToolProposal(requestId, proposalId, sellerId);
  if (!selected) {
    return NextResponse.json(
      { error: "이미 선택되었거나 처리할 수 없는 상태입니다." },
      { status: 409 }
    );
  }

  return NextResponse.json({ ok: true }, { status: 200 });
}
