import { NextResponse } from "next/server";
import { getCurrentSellerId } from "@/lib/session";
import { createToolProposal, getToolRequestById } from "@/lib/data";

const DURATION_MIN_LENGTH = 1;
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
  const duration = typeof body?.duration === "string" ? body.duration.trim() : "";
  const description = typeof body?.description === "string" ? body.description.trim() : "";

  const price = typeof priceRaw === "number" ? priceRaw : Number(priceRaw);
  if (!Number.isInteger(price) || price <= 0) {
    return NextResponse.json(
      { error: "가격은 0보다 큰 정수로 입력해주세요." },
      { status: 400 }
    );
  }
  if (duration.length < DURATION_MIN_LENGTH) {
    return NextResponse.json({ error: "작업 기간을 입력해주세요." }, { status: 400 });
  }
  if (description.length < DESCRIPTION_MIN_LENGTH) {
    return NextResponse.json(
      { error: `제안 내용은 ${DESCRIPTION_MIN_LENGTH}자 이상 입력해주세요.` },
      { status: 400 }
    );
  }

  const proposal = await createToolProposal({
    requestId,
    sellerId,
    price,
    duration,
    description,
  });

  return NextResponse.json({ id: proposal.id }, { status: 201 });
}
