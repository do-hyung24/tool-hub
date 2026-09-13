// 랜딩 메인 입력폼에서 작성한 초안을 로그인 전까지 브라우저에 임시로 보관한다.
// 서버에는 저장하지 않는다. 저장/조회/삭제 모두 실패해도(사생활 보호 모드 등)
// 예외를 던지지 않는다 - 호출부는 그냥 값이 없는 것처럼 동작하면 된다.

export const LANDING_DRAFT_STORAGE_KEY = "toolhub:landing-request-draft";
const MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000; // 7일

export type LandingDraft = { title: string; description: string; savedAt: number };

export function saveLandingDraft(draft: { title: string; description: string }): void {
  try {
    const value: LandingDraft = { ...draft, savedAt: Date.now() };
    localStorage.setItem(LANDING_DRAFT_STORAGE_KEY, JSON.stringify(value));
  } catch {
    // 저장 실패해도 흐름은 계속 진행한다 - 로그인 후 복원되지 않을 뿐이다.
  }
}

// 7일이 지난 초안은 읽지 않고 폐기(삭제)한다.
export function readLandingDraft(): LandingDraft | null {
  try {
    const raw = localStorage.getItem(LANDING_DRAFT_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<LandingDraft>;
    if (
      typeof parsed.title !== "string" ||
      typeof parsed.description !== "string" ||
      typeof parsed.savedAt !== "number"
    ) {
      return null;
    }
    if (Date.now() - parsed.savedAt > MAX_AGE_MS) {
      localStorage.removeItem(LANDING_DRAFT_STORAGE_KEY);
      return null;
    }
    return { title: parsed.title, description: parsed.description, savedAt: parsed.savedAt };
  } catch {
    return null;
  }
}

export function clearLandingDraft(): void {
  try {
    localStorage.removeItem(LANDING_DRAFT_STORAGE_KEY);
  } catch {
    // 무시
  }
}
