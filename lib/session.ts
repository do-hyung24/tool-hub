import "server-only";
import { auth } from "./auth";

// 로그인하지 않은 상태면 null을 반환한다. 호출부에서 반드시 null을 처리해야 한다
// (더 이상 "로그인 안 해도 기본값 s1" 같은 임시 동작은 없다).
export async function getCurrentSellerId(): Promise<string | null> {
  const session = await auth();
  return session?.user?.id ?? null;
}
