import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  LANDING_DRAFT_STORAGE_KEY,
  clearLandingDraft,
  readLandingDraft,
  saveLandingDraft,
} from "./landingDraft";

// vitest.config.ts는 environment: "node"라 전역 localStorage가 없다. 실제
// 브라우저와 같은 동기 Storage 인터페이스를 최소한으로 흉내낸다.
function createMemoryLocalStorage(): Storage {
  const store = new Map<string, string>();
  return {
    getItem: (key: string) => store.get(key) ?? null,
    setItem: (key: string, value: string) => {
      store.set(key, value);
    },
    removeItem: (key: string) => {
      store.delete(key);
    },
    clear: () => store.clear(),
    get length() {
      return store.size;
    },
    key: (index: number) => Array.from(store.keys())[index] ?? null,
  };
}

describe("landingDraft", () => {
  beforeEach(() => {
    vi.stubGlobal("localStorage", createMemoryLocalStorage());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("저장 직후 그대로 복원된다", () => {
    saveLandingDraft({ title: "스마트스토어 주문 정리", description: "매일 아침..." });
    const draft = readLandingDraft();
    expect(draft?.title).toBe("스마트스토어 주문 정리");
    expect(draft?.description).toBe("매일 아침...");
    expect(typeof draft?.savedAt).toBe("number");
  });

  it("등록 완료 후 삭제하면 더 이상 읽히지 않는다", () => {
    saveLandingDraft({ title: "제목", description: "설명" });
    clearLandingDraft();
    expect(readLandingDraft()).toBeNull();
  });

  it("저장 후 7일이 지나면 읽지 않고 폐기한다", () => {
    const eightDaysAgo = Date.now() - 8 * 24 * 60 * 60 * 1000;
    localStorage.setItem(
      LANDING_DRAFT_STORAGE_KEY,
      JSON.stringify({ title: "오래된 제목", description: "오래된 설명", savedAt: eightDaysAgo })
    );
    expect(readLandingDraft()).toBeNull();
    // 폐기 시 저장소에서도 제거되어야 한다.
    expect(localStorage.getItem(LANDING_DRAFT_STORAGE_KEY)).toBeNull();
  });

  it("7일 이내 경계값은 정상적으로 복원된다", () => {
    const sixDaysAgo = Date.now() - 6 * 24 * 60 * 60 * 1000;
    localStorage.setItem(
      LANDING_DRAFT_STORAGE_KEY,
      JSON.stringify({ title: "제목", description: "설명", savedAt: sixDaysAgo })
    );
    expect(readLandingDraft()).not.toBeNull();
  });

  it("깨진 JSON이 저장되어 있어도 에러 없이 null을 반환한다", () => {
    localStorage.setItem(LANDING_DRAFT_STORAGE_KEY, "{이건 JSON이 아님");
    expect(() => readLandingDraft()).not.toThrow();
    expect(readLandingDraft()).toBeNull();
  });

  it("형식이 맞지 않는 값은 null을 반환한다", () => {
    localStorage.setItem(LANDING_DRAFT_STORAGE_KEY, JSON.stringify({ title: 123 }));
    expect(readLandingDraft()).toBeNull();
  });

  it("localStorage 접근이 실패해도(사생활 보호 모드 등) 에러를 던지지 않는다", () => {
    vi.stubGlobal("localStorage", {
      getItem: () => {
        throw new Error("SecurityError");
      },
      setItem: () => {
        throw new Error("SecurityError");
      },
      removeItem: () => {
        throw new Error("SecurityError");
      },
    });

    expect(() => saveLandingDraft({ title: "제목", description: "설명" })).not.toThrow();
    expect(() => readLandingDraft()).not.toThrow();
    expect(readLandingDraft()).toBeNull();
    expect(() => clearLandingDraft()).not.toThrow();
  });
});
