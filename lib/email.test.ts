import { describe, expect, it } from "vitest";
import { escapeHtml } from "./email";

describe("escapeHtml", () => {
  it("이스케이프 대상 다섯 글자를 모두 치환한다", () => {
    expect(escapeHtml(`& < > " '`)).toBe("&amp; &lt; &gt; &quot; &#39;");
  });

  it("실제 XSS payload를 무력화한다(피드백 알림 메일 시나리오)", () => {
    const payload = "<img src=x onerror=alert(1)>";
    const escaped = escapeHtml(payload);
    expect(escaped).not.toContain("<img");
    expect(escaped).toBe("&lt;img src=x onerror=alert(1)&gt;");
  });

  it("일반 텍스트는 그대로 둔다", () => {
    expect(escapeHtml("평범한 한글 닉네임123")).toBe("평범한 한글 닉네임123");
  });

  it("&를 먼저 치환해 이중 이스케이프를 만들지 않는다", () => {
    expect(escapeHtml("<")).toBe("&lt;");
  });
});
