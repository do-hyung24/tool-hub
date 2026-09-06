import { describe, expect, it } from "vitest";
import { categoryForType, groupFindingsForBuyer } from "./findingCategories";
import type { Finding } from "./types";

function finding(overrides: Partial<Finding> & { type: string; severity: Finding["severity"] }): Finding {
  return {
    id: overrides.id ?? "f1",
    confidence: overrides.confidence ?? "medium",
    filePath: overrides.filePath ?? "bot.py",
    location: overrides.location ?? "1번째 줄",
    maskedEvidence: overrides.maskedEvidence ?? null,
    description: overrides.description ?? "",
    ...overrides,
  };
}

describe("categoryForType", () => {
  it("maps every known detector type to its buyer-facing category", () => {
    expect(categoryForType("hardcoded-secret")).toBe("secret-exposure");
    expect(categoryForType("high-entropy-literal")).toBe("secret-exposure");
    expect(categoryForType("dangerous-eval")).toBe("dangerous-code-execution");
    expect(categoryForType("dangerous-shell")).toBe("dangerous-code-execution");
    expect(categoryForType("insecure-tls")).toBe("insecure-network");
    expect(categoryForType("insecure-deserialization")).toBe("insecure-deserialization");
    expect(categoryForType("data-exfiltration")).toBe("data-exfiltration");
  });

  it("returns null for an unmapped type", () => {
    expect(categoryForType("some-future-type")).toBeNull();
  });
});

describe("groupFindingsForBuyer", () => {
  it("groups findings by category and keeps the highest severity per group", () => {
    const groups = groupFindingsForBuyer([
      finding({ type: "hardcoded-secret", severity: "medium" }),
      finding({ type: "hardcoded-secret", severity: "critical" }),
    ]);
    expect(groups).toHaveLength(1);
    expect(groups[0]).toMatchObject({ categoryId: "secret-exposure", severity: "critical" });
  });

  it("sorts groups from most to least severe", () => {
    const groups = groupFindingsForBuyer([
      finding({ type: "insecure-tls", severity: "medium" }),
      finding({ type: "hardcoded-secret", severity: "critical" }),
      finding({ type: "data-exfiltration", severity: "high" }),
    ]);
    expect(groups.map((g) => g.severity)).toEqual(["critical", "high", "medium"]);
  });

  it("silently drops findings whose type has no buyer-facing category mapping", () => {
    const groups = groupFindingsForBuyer([finding({ type: "some-future-type", severity: "high" })]);
    expect(groups).toHaveLength(0);
  });

  it("never exposes the underlying finding type", () => {
    const groups = groupFindingsForBuyer([finding({ type: "hardcoded-secret", severity: "critical" })]);
    expect(groups[0]).not.toHaveProperty("type");
    expect(JSON.stringify(groups[0])).not.toContain("hardcoded-secret");
  });

  it("uses the declarative secret-exposure label when hardcoded-secret is present", () => {
    const groups = groupFindingsForBuyer([
      finding({ type: "high-entropy-literal", severity: "medium" }),
      finding({ type: "hardcoded-secret", severity: "critical" }),
    ]);
    const secretGroup = groups.find((g) => g.categoryId === "secret-exposure");
    expect(secretGroup?.easyLabel).toBe("비밀번호나 API 키가 코드에 그대로 적혀 있어요");
  });

  it("uses the hedged secret-exposure label when only high-entropy-literal is present", () => {
    const groups = groupFindingsForBuyer([finding({ type: "high-entropy-literal", severity: "medium" })]);
    const secretGroup = groups.find((g) => g.categoryId === "secret-exposure");
    expect(secretGroup?.easyLabel).toBe(
      "비밀번호나 API 키로 보이는 값이 발견되어 확인이 필요해요"
    );
  });

  it("hedges the dangerous-code-execution easy label (needsLlmReview category, not a confirmed finding)", () => {
    const groups = groupFindingsForBuyer([finding({ type: "dangerous-eval", severity: "medium" })]);
    const group = groups.find((g) => g.categoryId === "dangerous-code-execution");
    expect(group?.easyLabel).toContain("확인이 필요해요");
  });

  it("hedges insecure-network, insecure-deserialization, and data-exfiltration easy labels", () => {
    const groups = groupFindingsForBuyer([
      finding({ type: "insecure-tls", severity: "medium" }),
      finding({ type: "insecure-deserialization", severity: "medium" }),
      finding({ type: "data-exfiltration", severity: "high" }),
    ]);
    for (const categoryId of ["insecure-network", "insecure-deserialization", "data-exfiltration"]) {
      const group = groups.find((g) => g.categoryId === categoryId);
      expect(group?.easyLabel).toContain("확인이 필요해요");
    }
  });

  it("includes a single expert label per category regardless of subtype", () => {
    const groups = groupFindingsForBuyer([finding({ type: "hardcoded-secret", severity: "critical" })]);
    expect(groups[0].expertLabel).toBe("시크릿/자격 증명 노출");
  });
});
