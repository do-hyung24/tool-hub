import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { z } from "zod";
import type { ScanResult } from "./types";

// 스캔 한 건에 Claude로 보낼 코드 총량 예산 (문자 수 기준).
const MAX_FILES = 6;
const MAX_TOTAL_CHARS = 40_000;
const MAX_FILE_BYTES = 20_000;

const SOURCE_EXTENSIONS = [
  ".ts",
  ".tsx",
  ".js",
  ".jsx",
  ".py",
  ".go",
  ".rb",
  ".java",
  ".rs",
  ".php",
];
const IGNORED_PATH_PATTERN = /(^|\/)(node_modules|dist|build|vendor|\.git)\//;

// 흔한 시크릿 패턴에 대한 1차 정규식 스캔. Claude 리뷰와 별개로 항상 실행된다.
const SECRET_PATTERNS: Array<{ label: string; regex: RegExp }> = [
  { label: "OpenAI 스타일 API 키(sk-...)", regex: /\bsk-[A-Za-z0-9_-]{20,}\b/ },
  { label: "Google API 키(AIza...)", regex: /\bAIza[0-9A-Za-z_-]{35}\b/ },
  { label: "AWS Access Key ID", regex: /\bAKIA[0-9A-Z]{16}\b/ },
  {
    label: "코드에 직접 대입된 api_key/secret/token/password",
    regex: /\b(api[_-]?key|secret|token|password)\s*[:=]\s*["'][^"'\s]{12,}["']/i,
  },
  { label: "긴 임의 문자열 하드코딩", regex: /["'][A-Za-z0-9+/]{40,}={0,2}["']/ },
];

const ScanReviewSchema = z.object({
  passed: z.boolean(),
  secretsFound: z.boolean(),
  findings: z.array(z.string()),
  suggestions: z.array(z.string()),
});

type RepoFile = { path: string; content: string };
type GithubTreeEntry = { path: string; type: string; size?: number };

function parseGithubUrl(githubUrl: string): { owner: string; repo: string } | null {
  let url: URL;
  try {
    url = new URL(githubUrl);
  } catch {
    return null;
  }
  if (!/(^|\.)github\.com$/i.test(url.hostname)) return null;

  const [owner, repoRaw] = url.pathname.split("/").filter(Boolean);
  if (!owner || !repoRaw) return null;
  return { owner, repo: repoRaw.replace(/\.git$/, "") };
}

async function githubFetchJson<T>(path: string): Promise<T | null> {
  const res = await fetch(`https://api.github.com${path}`, {
    headers: {
      Accept: "application/vnd.github+json",
      "User-Agent": "tool-hub-scan",
      ...(process.env.GITHUB_TOKEN
        ? { Authorization: `Bearer ${process.env.GITHUB_TOKEN}` }
        : {}),
    },
  });
  if (!res.ok) return null;
  return (await res.json()) as T;
}

// GitHub 저장소에서 README, package.json, 소스 파일 상위 몇 개를 골라
// 내용을 가져온다. 전체 용량은 MAX_TOTAL_CHARS로 제한된다.
async function collectRepoFiles(owner: string, repo: string): Promise<RepoFile[]> {
  const repoInfo = await githubFetchJson<{ default_branch: string }>(
    `/repos/${owner}/${repo}`
  );
  if (!repoInfo) return [];

  const tree = await githubFetchJson<{ tree: GithubTreeEntry[] }>(
    `/repos/${owner}/${repo}/git/trees/${encodeURIComponent(repoInfo.default_branch)}?recursive=1`
  );
  if (!tree) return [];

  const blobs = tree.tree.filter(
    (entry) => entry.type === "blob" && !IGNORED_PATH_PATTERN.test(entry.path)
  );

  const readme = blobs.find((entry) =>
    /^readme(\.md)?$/i.test(entry.path.split("/").pop() ?? "")
  );
  const packageJson = blobs.find((entry) => entry.path === "package.json");
  const sourceFiles = blobs
    .filter((entry) => SOURCE_EXTENSIONS.some((ext) => entry.path.endsWith(ext)))
    .sort((a, b) => (a.size ?? 0) - (b.size ?? 0))
    .slice(0, MAX_FILES);

  const seen = new Set<string>();
  const selected: GithubTreeEntry[] = [];
  for (const entry of [readme, packageJson, ...sourceFiles]) {
    if (entry && !seen.has(entry.path)) {
      seen.add(entry.path);
      selected.push(entry);
    }
  }

  const files: RepoFile[] = [];
  let remainingBudget = MAX_TOTAL_CHARS;
  for (const entry of selected) {
    if (remainingBudget <= 0) break;

    const rawUrl = `https://raw.githubusercontent.com/${owner}/${repo}/${repoInfo.default_branch}/${entry.path
      .split("/")
      .map(encodeURIComponent)
      .join("/")}`;
    const res = await fetch(rawUrl);
    if (!res.ok) continue;

    const full = await res.text();
    const content = full.slice(0, Math.min(MAX_FILE_BYTES, remainingBudget));
    remainingBudget -= content.length;
    files.push({ path: entry.path, content });
  }

  return files;
}

function scanForHardcodedSecrets(files: RepoFile[]): {
  found: boolean;
  matches: string[];
} {
  const matches = new Set<string>();
  for (const file of files) {
    for (const pattern of SECRET_PATTERNS) {
      if (pattern.regex.test(file.content)) {
        matches.add(`${pattern.label} (${file.path})`);
      }
    }
  }
  return { found: matches.size > 0, matches: [...matches] };
}

async function reviewWithClaude(
  repoLabel: string,
  files: RepoFile[],
  regexResult: { found: boolean; matches: string[] }
): Promise<z.infer<typeof ScanReviewSchema> | null> {
  const client = new Anthropic();

  const filesSection = files
    .map((file) => `### ${file.path}\n\`\`\`\n${file.content}\n\`\`\``)
    .join("\n\n");

  const response = await client.messages.parse({
    model: "claude-opus-5",
    max_tokens: 4096,
    output_config: {
      effort: "medium",
      format: zodOutputFormat(ScanReviewSchema),
    },
    system:
      "당신은 개인 개발자가 만든 자동화 봇/스크립트를 다른 사용자에게 판매하기 전에 " +
      "검수하는 보안 리뷰어입니다. 코드에서 하드코딩된 API 키/시크릿, 인증·권한 체크 누락, " +
      "명백히 위험하거나 악의적인 동작, 오래되었거나 취약해 보이는 의존성 여부를 검토하세요. " +
      "일반 소비자가 이해할 수 있도록 findings와 suggestions를 한국어로 간결하게 작성하고, " +
      "심각한 문제가 없다면 findings/suggestions는 빈 배열로 두고 passed를 true로 설정하세요.",
    messages: [
      {
        role: "user",
        content:
          `저장소: ${repoLabel}\n` +
          `정규식 기반 1차 시크릿 스캔 결과: ${
            regexResult.found
              ? `의심 패턴 발견 - ${regexResult.matches.join(", ")}`
              : "발견되지 않음"
          }\n\n` +
          `아래는 저장소 주요 파일의 일부입니다 (용량 제한으로 일부만 포함됨):\n\n${
            filesSection || "(가져올 수 있는 파일이 없었습니다)"
          }`,
      },
    ],
  });

  return response.parsed_output;
}

export async function scanRepository(githubUrl: string): Promise<ScanResult> {
  const scannedAt = new Date().toISOString();
  const parsed = parseGithubUrl(githubUrl);

  if (!parsed) {
    return {
      hasHardcodedSecret: false,
      hasVulnerableDependency: false,
      scannedAt,
      passed: false,
      findings: ["GitHub 저장소 링크를 인식하지 못해 자동 스캔을 진행하지 못했습니다."],
      suggestions: [
        "코드 링크가 공개 GitHub 저장소 URL인지 확인해주세요 (예: https://github.com/owner/repo).",
      ],
    };
  }

  try {
    const files = await collectRepoFiles(parsed.owner, parsed.repo);
    const regexResult = scanForHardcodedSecrets(files);

    if (files.length === 0) {
      return {
        hasHardcodedSecret: regexResult.found,
        hasVulnerableDependency: false,
        scannedAt,
        passed: false,
        findings: ["저장소 파일을 가져오지 못했습니다. 저장소가 존재하지 않거나 비공개일 수 있습니다."],
        suggestions: ["저장소가 공개(public) 상태인지 확인해주세요."],
      };
    }

    if (!process.env.ANTHROPIC_API_KEY) {
      return {
        hasHardcodedSecret: regexResult.found,
        hasVulnerableDependency: false,
        scannedAt,
        passed: !regexResult.found,
        findings: regexResult.found
          ? [`정규식 스캔에서 의심되는 시크릿 패턴이 발견되었습니다: ${regexResult.matches.join(", ")}`]
          : [],
        suggestions: [
          "ANTHROPIC_API_KEY가 설정되지 않아 AI 코드 리뷰는 건너뛰었습니다. 정규식 기반 결과만 반영되었습니다.",
        ],
      };
    }

    const review = await reviewWithClaude(
      `${parsed.owner}/${parsed.repo}`,
      files,
      regexResult
    );

    if (!review) {
      return {
        hasHardcodedSecret: regexResult.found,
        hasVulnerableDependency: false,
        scannedAt,
        passed: false,
        findings: ["AI 리뷰 응답을 해석하지 못해 수동 확인이 필요합니다."],
        suggestions: ["잠시 후 다시 스캔을 시도해주세요."],
      };
    }

    const hasHardcodedSecret = regexResult.found || review.secretsFound;

    return {
      hasHardcodedSecret,
      // CVE 기반 의존성 취약점 스캔은 아직 구현되지 않았습니다 (AGENTS.md 로드맵 참고).
      hasVulnerableDependency: false,
      scannedAt,
      passed: review.passed && !hasHardcodedSecret,
      findings: review.findings,
      suggestions: review.suggestions,
    };
  } catch (error) {
    return {
      hasHardcodedSecret: false,
      hasVulnerableDependency: false,
      scannedAt,
      passed: false,
      findings: [
        `스캔 중 오류가 발생했습니다: ${error instanceof Error ? error.message : String(error)}`,
      ],
      suggestions: ["잠시 후 다시 시도해주세요."],
    };
  }
}
