import { afterEach, describe, expect, it, vi } from "vitest";
import type { RawFinding } from "./detector";
import type { ScannableFile } from "./scannableFile";

const anthropicConstructor = vi.fn();

vi.mock("@anthropic-ai/sdk", () => ({
  default: class {
    messages = { parse: vi.fn().mockResolvedValue({ parsed_output: { items: [] } }) };
    constructor(...args: unknown[]) {
      anthropicConstructor(...args);
    }
  },
}));

const { reviewAmbiguousFindings } = await import("./llmReview");

function ambiguousFinding(): RawFinding {
  return {
    id: "1",
    severity: "medium",
    confidence: "low",
    type: "dangerous-eval",
    cwe: "CWE-95",
    filePath: "index.ts",
    location: "1번째 줄",
    maskedEvidence: null,
    description: "eval() 호출 패턴이 발견되었습니다.",
    needsLlmReview: true,
    lineNumber: 1,
  };
}

const files: ScannableFile[] = [{ path: "index.ts", content: "eval(x)" }];

describe("reviewAmbiguousFindings - LLM hybrid flag", () => {
  const originalEnv = { ...process.env };

  afterEach(() => {
    process.env = { ...originalEnv };
    anthropicConstructor.mockClear();
  });

  it("returns findings unchanged and never calls the Anthropic API when ENABLE_LLM_HYBRID is unset", async () => {
    delete process.env.ENABLE_LLM_HYBRID;
    process.env.ANTHROPIC_API_KEY = "test-key";
    const findings = [ambiguousFinding()];

    const result = await reviewAmbiguousFindings(findings, files);

    expect(result).toEqual(findings);
    expect(anthropicConstructor).not.toHaveBeenCalled();
  });

  it("returns findings unchanged when ENABLE_LLM_HYBRID is explicitly false", async () => {
    process.env.ENABLE_LLM_HYBRID = "false";
    process.env.ANTHROPIC_API_KEY = "test-key";
    const findings = [ambiguousFinding()];

    const result = await reviewAmbiguousFindings(findings, files);

    expect(result).toEqual(findings);
    expect(anthropicConstructor).not.toHaveBeenCalled();
  });
});
