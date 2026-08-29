import "server-only";
import { randomUUID } from "node:crypto";
import type { ScannableFile } from "./scannableFile";
import type { Confidence, Finding, Severity } from "./types";

export const RULE_ENGINE_VERSION = "rule-engine-2026-08-27-v1";

// 규칙 기반 탐지 결과에 "LLM으로 문맥 판단이 필요한지" 여부와, 문맥 스니펫을
// 잘라낼 때 쓸 줄 번호를 붙인 내부 전용 타입입니다. saveScanReport로 저장하기
// 전에 이 필드들은 제거됩니다.
export type RawFinding = Finding & { needsLlmReview: boolean; lineNumber: number };

type SecretPattern = {
  type: string;
  severity: Severity;
  confidence: Confidence;
  label: string;
  regex: RegExp;
};

// 특정 서비스에 귀속되는 시크릿 패턴 - 오탐률이 낮아 확정적으로 판단한다.
const KNOWN_SECRET_PATTERNS: SecretPattern[] = [
  {
    type: "hardcoded-secret",
    severity: "critical",
    confidence: "high",
    label: "OpenAI 스타일 API 키(sk-...)",
    regex: /\bsk-[A-Za-z0-9_-]{20,}\b/g,
  },
  {
    type: "hardcoded-secret",
    severity: "critical",
    confidence: "high",
    label: "Google API 키(AIza...)",
    regex: /\bAIza[0-9A-Za-z_-]{35}\b/g,
  },
  {
    type: "hardcoded-secret",
    severity: "critical",
    confidence: "high",
    label: "AWS Access Key ID",
    regex: /\bAKIA[0-9A-Z]{16}\b/g,
  },
  {
    type: "hardcoded-secret",
    severity: "critical",
    confidence: "high",
    label: "DB 연결 문자열에 포함된 자격 증명",
    regex: /\b(postgres(?:ql)?|mysql|mongodb(?:\+srv)?|redis):\/\/[^:\s'"]+:[^@\s'"]+@[^\s'"]+/gi,
  },
  {
    type: "hardcoded-secret",
    severity: "high",
    confidence: "medium",
    label: "코드에 직접 대입된 api_key/secret/token/password",
    regex: /\b(api[_-]?key|secret|token|password)\s*[:=]\s*["'][^"'\s]{12,}["']/gi,
  },
];

// 애매한 경우: 고엔트로피 문자열 리터럴. 실제 시크릿일 수도, 해시/UUID/난독화된
// 식별자 같은 오탐일 수도 있어 needsLlmReview로 표시한다.
const HIGH_ENTROPY_LITERAL_REGEX = /["']([A-Za-z0-9+/_=-]{20,})["']/g;
const HIGH_ENTROPY_THRESHOLD = 3.5;

// 위험 함수 호출 패턴. 자동화 봇의 정상 기능(예: 브라우저/셸 자동화)일 수도 있어
// 기본적으로 문맥 판단이 필요한 항목(needsLlmReview)으로 분류한다.
const DANGEROUS_FUNCTION_PATTERNS: Array<{
  type: string;
  label: string;
  regex: RegExp;
}> = [
  { type: "dangerous-eval", label: "eval() 호출", regex: /\beval\s*\(/g },
  { type: "dangerous-eval", label: "new Function() 동적 코드 생성", regex: /\bnew\s+Function\s*\(/g },
  { type: "dangerous-eval", label: "Python exec() 호출", regex: /\bexec\s*\(/g },
  {
    type: "dangerous-shell",
    label: "child_process 모듈 사용",
    regex: /\brequire\(\s*['"]child_process['"]\s*\)|\bfrom\s+['"]child_process['"]|\bimport\s+child_process/g,
  },
  {
    type: "dangerous-shell",
    label: "외부 명령 실행 함수 호출(exec/execSync/spawn 등)",
    regex: /\b(execSync|spawnSync|spawn)\s*\(/g,
  },
  {
    type: "dangerous-shell",
    label: "Python subprocess/os.system 사용",
    regex: /\bsubprocess\.(run|call|Popen|check_output)\s*\(|\bos\.(system|popen)\s*\(/g,
  },
  {
    type: "dangerous-shell",
    label: "다운로드한 스크립트를 바로 셸로 실행하는 패턴",
    regex: /\b(curl|wget)\b[^\n]*\|\s*(sh|bash|zsh)\b/g,
  },
];

function shannonEntropy(value: string): number {
  const counts = new Map<string, number>();
  for (const char of value) counts.set(char, (counts.get(char) ?? 0) + 1);
  let entropy = 0;
  for (const count of counts.values()) {
    const p = count / value.length;
    entropy -= p * Math.log2(p);
  }
  return entropy;
}

function lineNumberAt(content: string, index: number): number {
  let line = 1;
  for (let i = 0; i < index; i++) {
    if (content[i] === "\n") line++;
  }
  return line;
}

// 값 전체를 절대 저장/전송하지 않고, 앞/뒤 일부만 남기고 마스킹한다.
export function maskSecretValue(raw: string): string {
  const trimmed = raw.trim();
  if (trimmed.length <= 8) return "*".repeat(trimmed.length);
  return `${trimmed.slice(0, 3)}***...${trimmed.slice(-3)}`;
}

function findAllMatches(content: string, regex: RegExp): RegExpExecArray[] {
  const matches: RegExpExecArray[] = [];
  const re = new RegExp(regex.source, regex.flags.includes("g") ? regex.flags : `${regex.flags}g`);
  let match: RegExpExecArray | null;
  while ((match = re.exec(content)) !== null) {
    matches.push(match);
    // zero-length 매치 방지
    if (match[0].length === 0) re.lastIndex++;
  }
  return matches;
}

function detectKnownSecrets(file: ScannableFile): RawFinding[] {
  const findings: RawFinding[] = [];
  for (const pattern of KNOWN_SECRET_PATTERNS) {
    for (const match of findAllMatches(file.content, pattern.regex)) {
      const lineNumber = lineNumberAt(file.content, match.index);
      findings.push({
        id: randomUUID(),
        severity: pattern.severity,
        confidence: pattern.confidence,
        type: pattern.type,
        filePath: file.path,
        location: `${lineNumber}번째 줄`,
        maskedEvidence: maskSecretValue(match[0]),
        description: `${pattern.label}로 보이는 문자열이 발견되었습니다.`,
        needsLlmReview: false,
        lineNumber,
      });
    }
  }
  return findings;
}

function detectHighEntropyLiterals(
  file: ScannableFile,
  alreadyMatchedRanges: Array<[number, number]>
): RawFinding[] {
  const findings: RawFinding[] = [];
  for (const match of findAllMatches(file.content, HIGH_ENTROPY_LITERAL_REGEX)) {
    const start = match.index;
    const end = start + match[0].length;
    const overlapsKnown = alreadyMatchedRanges.some(([s, e]) => start < e && end > s);
    if (overlapsKnown) continue;

    const literal = match[1];
    const entropy = shannonEntropy(literal);
    if (entropy < HIGH_ENTROPY_THRESHOLD) continue;

    const lineNumber = lineNumberAt(file.content, start);
    findings.push({
      id: randomUUID(),
      severity: "medium",
      confidence: "low",
      type: "high-entropy-literal",
      filePath: file.path,
      location: `${lineNumber}번째 줄`,
      maskedEvidence: maskSecretValue(literal),
      description:
        "무작위성이 높은 문자열 리터럴이 발견되었습니다. 시크릿일 수도 있고, 해시/식별자 등 무해한 값일 수도 있습니다.",
      needsLlmReview: true,
      lineNumber,
    });
  }
  return findings;
}

function detectDangerousFunctions(file: ScannableFile): RawFinding[] {
  const findings: RawFinding[] = [];
  for (const pattern of DANGEROUS_FUNCTION_PATTERNS) {
    for (const match of findAllMatches(file.content, pattern.regex)) {
      const lineNumber = lineNumberAt(file.content, match.index);
      findings.push({
        id: randomUUID(),
        severity: "medium",
        confidence: "low",
        type: pattern.type,
        filePath: file.path,
        location: `${lineNumber}번째 줄`,
        maskedEvidence: null,
        description: `${pattern.label} 패턴이 발견되었습니다. 자동화 도구의 정상 기능일 수도 있어 문맥 확인이 필요합니다.`,
        needsLlmReview: true,
        lineNumber,
      });
    }
  }
  return findings;
}

// LLM에 문맥 스니펫을 보내기 전에, 알려진 시크릿 패턴과 고엔트로피 리터럴을
// 모두 마스킹한다. LLM 호출 경로에서 원문 시크릿이 절대 전송되지 않도록 하는
// 마지막 방어선이다.
export function redactSecrets(text: string): string {
  let redacted = text;
  for (const pattern of KNOWN_SECRET_PATTERNS) {
    redacted = redacted.replace(pattern.regex, (matched) => maskSecretValue(matched));
  }
  redacted = redacted.replace(HIGH_ENTROPY_LITERAL_REGEX, (full, literal: string) =>
    shannonEntropy(literal) >= HIGH_ENTROPY_THRESHOLD
      ? full.replace(literal, maskSecretValue(literal))
      : full
  );
  return redacted;
}

// 규칙 기반 탐지기. GitHub/zip 어느 경로로 왔든 동일한 ScannableFile[] 입력을 받는다.
export function detectFindings(files: ScannableFile[]): RawFinding[] {
  const findings: RawFinding[] = [];

  for (const file of files) {
    const knownSecrets = detectKnownSecrets(file);
    findings.push(...knownSecrets);

    const knownRanges: Array<[number, number]> = [];
    for (const pattern of KNOWN_SECRET_PATTERNS) {
      for (const match of findAllMatches(file.content, pattern.regex)) {
        knownRanges.push([match.index, match.index + match[0].length]);
      }
    }
    findings.push(...detectHighEntropyLiterals(file, knownRanges));
    findings.push(...detectDangerousFunctions(file));
  }

  return findings;
}
