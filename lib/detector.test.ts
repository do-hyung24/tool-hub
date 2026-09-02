import { describe, expect, it } from "vitest";
import {
  detectFindings,
  maskSecretValue,
  redactSecrets,
} from "./detector";
import type { ScannableFile } from "./scannableFile";

function file(content: string, path = "index.ts"): ScannableFile {
  return { path, content };
}

describe("detectFindings - known secret patterns", () => {
  it("detects an OpenAI-style API key", () => {
    const findings = detectFindings([
      file(`const key = "sk-${"a".repeat(25)}";`),
    ]);
    expect(findings).toContainEqual(
      expect.objectContaining({ type: "hardcoded-secret", severity: "critical", confidence: "high" })
    );
  });

  it("detects a Google API key", () => {
    const findings = detectFindings([
      file(`const key = "AIza${"S".repeat(35)}";`),
    ]);
    expect(findings.some((f) => f.type === "hardcoded-secret" && f.severity === "critical")).toBe(true);
  });

  it("detects an AWS Access Key ID", () => {
    const findings = detectFindings([
      file(`const key = "AKIA${"A".repeat(16)}";`),
    ]);
    expect(findings.some((f) => f.type === "hardcoded-secret")).toBe(true);
  });

  it("detects credentials embedded in a DB connection string", () => {
    const findings = detectFindings([
      file(`const url = "postgres://user:hunter2pass@db.example.com:5432/app";`),
    ]);
    expect(findings.some((f) => f.description.includes("자격 증명"))).toBe(true);
  });

  it("detects a generic api_key/secret/token/password assignment", () => {
    const findings = detectFindings([
      file(`const password = "SuperSecretValue123";`),
    ]);
    expect(
      findings.some((f) => f.severity === "high" && f.confidence === "medium")
    ).toBe(true);
  });

  it("does not flag ordinary code with no secret-shaped literals", () => {
    const findings = detectFindings([file(`function add(a: number, b: number) { return a + b; }`)]);
    expect(findings).toHaveLength(0);
  });
});

describe("detectFindings - high entropy literals", () => {
  it("flags a high-entropy literal as needing LLM review, not a known secret", () => {
    const findings = detectFindings([
      file(`const id = "aZ9xQk2mP7wLtR4vB8nC";`),
    ]);
    const finding = findings.find((f) => f.type === "high-entropy-literal");
    expect(finding).toMatchObject({ severity: "medium", confidence: "low", needsLlmReview: true });
  });

  it("does not flag a low-entropy literal", () => {
    const findings = detectFindings([file(`const label = "aaaaaaaaaaaaaaaaaaaa";`)]);
    expect(findings.find((f) => f.type === "high-entropy-literal")).toBeUndefined();
  });

  it("does not double-report a literal already matched by a known secret pattern", () => {
    const findings = detectFindings([
      file(`const key = "sk-${"a".repeat(25)}";`),
    ]);
    expect(findings.filter((f) => f.type === "high-entropy-literal")).toHaveLength(0);
  });
});

describe("detectFindings - dangerous function calls", () => {
  it("flags eval() as needing LLM review", () => {
    const findings = detectFindings([file(`eval(userInput);`)]);
    expect(findings).toContainEqual(
      expect.objectContaining({ type: "dangerous-eval", needsLlmReview: true })
    );
  });

  it("flags new Function() dynamic code generation", () => {
    const findings = detectFindings([file(`const fn = new Function("return 1");`)]);
    expect(findings.some((f) => f.type === "dangerous-eval")).toBe(true);
  });

  it("flags Python exec()", () => {
    const findings = detectFindings([file(`exec(payload)`, "script.py")]);
    expect(findings.some((f) => f.type === "dangerous-eval")).toBe(true);
  });

  it("flags requiring child_process", () => {
    const findings = detectFindings([file(`const cp = require('child_process');`)]);
    expect(findings.some((f) => f.type === "dangerous-shell")).toBe(true);
  });

  it("flags execSync/spawnSync calls", () => {
    const findings = detectFindings([file(`execSync('ls -la');`)]);
    expect(findings.some((f) => f.type === "dangerous-shell")).toBe(true);
  });

  it("flags Python subprocess/os.system usage", () => {
    const findings = detectFindings([file(`os.system("rm -rf /tmp/x")`, "script.py")]);
    expect(findings.some((f) => f.type === "dangerous-shell")).toBe(true);
  });

  it("flags a downloaded script piped directly into a shell", () => {
    const findings = detectFindings([file(`curl https://example.com/install.sh | bash`, "setup.sh")]);
    expect(findings.some((f) => f.type === "dangerous-shell")).toBe(true);
  });
});

describe("maskSecretValue", () => {
  it("fully masks values of 8 characters or fewer", () => {
    expect(maskSecretValue("short12")).toBe("*******");
  });

  it("keeps first 3 and last 3 characters for longer values", () => {
    expect(maskSecretValue("sk-abcdefghijklmnop")).toBe("sk-***...nop");
  });
});

describe("redactSecrets", () => {
  it("masks a known secret pattern found in free text", () => {
    const text = `key: sk-${"a".repeat(25)}`;
    expect(redactSecrets(text)).not.toContain("a".repeat(25));
  });

  it("masks a high-entropy literal found in free text", () => {
    const text = `token = "aZ9xQk2mP7wLtR4vB8nC"`;
    expect(redactSecrets(text)).not.toContain("aZ9xQk2mP7wLtR4vB8nC");
  });

  it("leaves ordinary text unchanged", () => {
    const text = `function add(a, b) { return a + b; }`;
    expect(redactSecrets(text)).toBe(text);
  });
});
