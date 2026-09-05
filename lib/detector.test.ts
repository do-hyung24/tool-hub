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

describe("detectFindings - insecure TLS verification", () => {
  it("flags Node rejectUnauthorized: false", () => {
    const findings = detectFindings([
      file(`https.request({ hostname, rejectUnauthorized: false });`),
    ]);
    expect(findings).toContainEqual(
      expect.objectContaining({ type: "insecure-tls", needsLlmReview: true })
    );
  });

  it("flags NODE_TLS_REJECT_UNAUTHORIZED=0", () => {
    const findings = detectFindings([
      file(`process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";`),
    ]);
    expect(findings.some((f) => f.type === "insecure-tls")).toBe(true);
  });

  it("flags Python requests call with verify=False", () => {
    const findings = detectFindings([
      file(`requests.get(url, verify=False)`, "script.py"),
    ]);
    expect(findings.some((f) => f.type === "insecure-tls")).toBe(true);
  });

  it("flags Python ssl._create_unverified_context", () => {
    const findings = detectFindings([
      file(`ctx = ssl._create_unverified_context()`, "script.py"),
    ]);
    expect(findings.some((f) => f.type === "insecure-tls")).toBe(true);
  });
});

describe("detectFindings - insecure deserialization", () => {
  it("flags pickle.loads()", () => {
    const findings = detectFindings([
      file(`data = pickle.loads(raw_bytes)`, "script.py"),
    ]);
    expect(findings).toContainEqual(
      expect.objectContaining({ type: "insecure-deserialization", needsLlmReview: true })
    );
  });

  it("flags marshal.loads()", () => {
    const findings = detectFindings([
      file(`data = marshal.loads(raw_bytes)`, "script.py"),
    ]);
    expect(findings.some((f) => f.type === "insecure-deserialization")).toBe(true);
  });

  it("flags yaml.load() without a safe loader", () => {
    const findings = detectFindings([
      file(`data = yaml.load(stream)`, "script.py"),
    ]);
    expect(findings.some((f) => f.type === "insecure-deserialization")).toBe(true);
  });

  it("does not flag yaml.load() when using SafeLoader", () => {
    const findings = detectFindings([
      file(`data = yaml.load(stream, Loader=yaml.SafeLoader)`, "script.py"),
    ]);
    expect(findings.some((f) => f.type === "insecure-deserialization")).toBe(false);
  });
});

describe("detectFindings - data exfiltration endpoints", () => {
  it("flags a Discord webhook URL", () => {
    const findings = detectFindings([
      file(`const hook = "https://discord.com/api/webhooks/123456/${"a".repeat(20)}";`),
    ]);
    expect(findings).toContainEqual(
      expect.objectContaining({ type: "data-exfiltration", needsLlmReview: true })
    );
  });

  it("flags a Telegram bot API URL", () => {
    const findings = detectFindings([
      file(`const url = "https://api.telegram.org/bot123456:${"a".repeat(20)}/sendMessage";`),
    ]);
    expect(findings.some((f) => f.type === "data-exfiltration")).toBe(true);
  });

  it("flags an ngrok tunnel URL", () => {
    const findings = detectFindings([
      file(`const target = "https://my-tunnel.ngrok-free.app/collect";`),
    ]);
    expect(findings.some((f) => f.type === "data-exfiltration")).toBe(true);
  });

  it("masks the matched URL instead of exposing it in full", () => {
    const url = `https://discord.com/api/webhooks/123456/${"a".repeat(20)}`;
    const findings = detectFindings([file(`const hook = "${url}";`)]);
    const finding = findings.find((f) => f.type === "data-exfiltration");
    expect(finding?.maskedEvidence).not.toContain(url);
  });

  it("does not double-report a webhook URL as a high-entropy literal", () => {
    const url = `https://discord.com/api/webhooks/123456/${"a".repeat(20)}`;
    const findings = detectFindings([file(`const hook = "${url}";`)]);
    expect(findings.filter((f) => f.type === "high-entropy-literal")).toHaveLength(0);
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
