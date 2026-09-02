import { afterEach, describe, expect, it } from "vitest";
import { detectFindings } from "./detector";
import { runScan } from "./scanEngine";
import type { ScannableFile } from "./scannableFile";

describe("runScan - rule-based only (LLM hybrid disabled by default)", () => {
  const originalEnv = process.env.ENABLE_LLM_HYBRID;

  afterEach(() => {
    if (originalEnv === undefined) delete process.env.ENABLE_LLM_HYBRID;
    else process.env.ENABLE_LLM_HYBRID = originalEnv;
  });

  it("returns exactly the rule-based findings, stripped of internal review fields", async () => {
    delete process.env.ENABLE_LLM_HYBRID;
    const files: ScannableFile[] = [
      { path: "index.ts", content: `eval(x); const key = "sk-${"a".repeat(25)}";` },
    ];

    const raw = detectFindings(files);
    const result = await runScan(files);

    const asComparable = (f: {
      severity: string;
      confidence: string;
      type: string;
      filePath: string;
      location: string | null;
      maskedEvidence: string | null;
      description: string;
    }) => ({
      severity: f.severity,
      confidence: f.confidence,
      type: f.type,
      filePath: f.filePath,
      location: f.location,
      maskedEvidence: f.maskedEvidence,
      description: f.description,
    });
    expect(result.map(asComparable)).toEqual(raw.map(asComparable));
    expect(result.some((f) => f.type === "dangerous-eval")).toBe(true);
    expect(result.some((f) => f.type === "hardcoded-secret")).toBe(true);
  });
});
