import { NextResponse } from "next/server";
import { getCurrentSellerId } from "@/lib/session";
import { createToolProposal, getToolRequestById } from "@/lib/data";
import { getKstDeadlineBounds } from "@/app/api/requests/shared";
import { DATE_ONLY_PATTERN, daysBetween, getKstTodayDateString } from "@/lib/dday";

const DESCRIPTION_MIN_LENGTH = 5;

export async function POST(
  request: Request,
  { params }: { params: Promise<{ requestId: string }> }
) {
  const sellerId = await getCurrentSellerId();
  if (!sellerId) {
    return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });
  }

  const { requestId } = await params;
  const toolRequest = await getToolRequestById(requestId);
  if (!toolRequest) {
    return NextResponse.json({ error: "의뢰를 찾을 수 없습니다." }, { status: 404 });
  }
  if (toolRequest.status !== "open") {
    return NextResponse.json({ error: "마감된 의뢰입니다." }, { status: 400 });
  }
  if (toolRequest.requesterSellerId === sellerId) {
    return NextResponse.json({ error: "본인 의뢰에는 제안할 수 없습니다." }, { status: 400 });
  }

  const body = await request.json().catch(() => null);
  const priceRaw = body?.price;
  const proposedCompletionDate =
    typeof body?.proposedCompletionDate === "string" ? body.proposedCompletionDate.trim() : "";
  const description = typeof body?.description === "string" ? body.description.trim() : "";

  const price = typeof priceRaw === "number" ? priceRaw : Number(priceRaw);
  if (!Number.isInteger(price) || price <= 0) {
    return NextResponse.json(
      { error: "가격은 0보다 큰 정수로 입력해주세요." },
      { status: 400 }
    );
  }
  // 클라이언트의 <input type="date"> min/max는 devtools 등으로 우회 가능하므로
  // 서버에서도 NewRequestForm의 희망완료시점과 동일한 KST 범위로 재검증한다.
  const { min, max } = getKstDeadlineBounds();
  const isValidDate =
    DATE_ONLY_PATTERN.test(proposedCompletionDate) &&
    proposedCompletionDate >= min &&
    proposedCompletionDate <= max;
  if (!isValidDate) {
    return NextResponse.json(
      { error: "완료 예정일은 오늘부터 6개월 이내로 선택해주세요." },
      { status: 400 }
    );
  }
  if (description.length < DESCRIPTION_MIN_LENGTH) {
    return NextResponse.json(
      { error: `제안 내용은 ${DESCRIPTION_MIN_LENGTH}자 이상 입력해주세요.` },
      { status: 400 }
    );
  }

  // 기존 duration TEXT NOT NULL 컬럼은 스키마를 바꾸지 않고 그대로 두되, 폼이
  // 더 이상 자유 입력을 받지 않으므로 완료 예정일로부터 일수를 계산해 채운다.
  const durationDays = Math.max(0, daysBetween(getKstTodayDateString(), proposedCompletionDate));
  const duration = `${durationDays}일`;

  const proposal = await createToolProposal({
    requestId,
    sellerId,
    price,
    duration,
    description,
    proposedCompletionDate,
  });

  return NextResponse.json({ id: proposal.id }, { status: 201 });
}
