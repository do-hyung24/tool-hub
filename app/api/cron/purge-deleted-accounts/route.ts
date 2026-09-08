import { NextResponse } from "next/server";
import { purgeExpiredDeletedAccounts } from "@/lib/data";

// Vercel Cron이 매일 호출한다 (vercel.json 참고). 외부에서 함부로 호출하지 못하도록
// CRON_SECRET과 정확히 일치하는 Authorization: Bearer 헤더를 요구한다.
// CRON_SECRET이 아예 설정되지 않은 경우까지 명시적으로 거부해야, 헤더를 아예 보내지
// 않은 요청이 "undefined === undefined"로 우연히 통과하는 일이 없다.
export async function GET(request: Request) {
  const cronSecret = process.env.CRON_SECRET;
  const authHeader = request.headers.get("authorization");

  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { purgedCount } = await purgeExpiredDeletedAccounts();
  return NextResponse.json({ purgedCount });
}
