import { describe, expect, it } from "vitest";
import { findObfuscatedDigitRuns, maskPersonalInfo } from "./piiMask";

describe("maskPersonalInfo", () => {
  it("masks a mobile phone number with hyphens", () => {
    const result = maskPersonalInfo("연락처는 010-1234-5678 입니다");
    expect(result.text).toBe("연락처는 [연락처 비공개] 입니다");
    expect(result.maskedCount).toBe(1);
  });

  it("masks a mobile phone number with no separators", () => {
    const result = maskPersonalInfo("연락처는 01012345678 입니다");
    expect(result.text).toBe("연락처는 [연락처 비공개] 입니다");
    expect(result.maskedCount).toBe(1);
  });

  it("masks a landline number", () => {
    const result = maskPersonalInfo("전화는 02-123-4567 입니다");
    expect(result.text).toBe("전화는 [연락처 비공개] 입니다");
    expect(result.maskedCount).toBe(1);
  });

  it("masks an email address", () => {
    const result = maskPersonalInfo("메일은 test@example.com 입니다");
    expect(result.text).toBe("메일은 [이메일 비공개] 입니다");
    expect(result.maskedCount).toBe(1);
  });

  it("masks a resident registration number shape", () => {
    const result = maskPersonalInfo("주민번호 900101-1234567 입니다");
    expect(result.text).toBe("주민번호 [개인정보 비공개] 입니다");
    expect(result.maskedCount).toBe(1);
  });

  it("masks a long digit run as an account number", () => {
    const result = maskPersonalInfo("계좌번호 1234567890123 입니다");
    expect(result.text).toBe("계좌번호 [계좌 비공개] 입니다");
    expect(result.maskedCount).toBe(1);
  });

  it("counts multiple masked spans in one description", () => {
    const result = maskPersonalInfo("010-1234-5678 또는 test@example.com 로 연락주세요");
    expect(result.maskedCount).toBe(2);
    expect(result.text).not.toContain("1234-5678");
    expect(result.text).not.toContain("test@example.com");
  });

  it("does not leave the original digits anywhere in the masked text", () => {
    const result = maskPersonalInfo("010-1234-5678");
    expect(result.text).not.toMatch(/\d/);
  });
});

describe("findObfuscatedDigitRuns", () => {
  it("flags a phone number spelled out with Korean numeral words", () => {
    const warnings = findObfuscatedDigitRuns("공1공 삼3사1 팔구2오");
    expect(warnings).toHaveLength(1);
  });

  it("flags a phone number written with fullwidth digits", () => {
    const warnings = findObfuscatedDigitRuns("０１０１２３４５６７８");
    expect(warnings).toHaveLength(1);
  });

  it("flags a phone number using o/l letter substitution", () => {
    const warnings = findObfuscatedDigitRuns("o1o-1234-5678");
    expect(warnings).toHaveLength(1);
  });

  it("does not flag a normal counting sentence", () => {
    expect(findObfuscatedDigitRuns("일이삼사 순서로 정렬")).toHaveLength(0);
  });

  it("does not flag a time-of-day sentence", () => {
    expect(findObfuscatedDigitRuns("오전 9시 실행")).toHaveLength(0);
  });

  it("does not flag a date sentence", () => {
    expect(findObfuscatedDigitRuns("2026년 1월 1일부터")).toHaveLength(0);
  });

  it("does not flag a small quantity sentence", () => {
    expect(findObfuscatedDigitRuns("엑셀 3만 건")).toHaveLength(0);
  });

  it("does not treat o/l inside an ordinary English word as digits", () => {
    expect(findObfuscatedDigitRuns("hello world")).toHaveLength(0);
  });
});
