// 로그인 후 돌아갈 경로(next)를 정제한다 - 오픈 리다이렉트 방지를 위해
// 이 사이트 안의 절대 경로("/"로 시작)만 허용하고, 그 외에는 홈으로 보낸다.
export function safeNextPath(raw: unknown): string {
  if (typeof raw !== "string") return "/";
  if (!raw.startsWith("/")) return "/";
  if (raw.startsWith("//") || raw.startsWith("/\\")) return "/";
  if (raw.includes(":")) return "/";
  return raw;
}
