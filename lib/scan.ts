import "server-only";
import type { ScannableFile } from "./scannableFile";

// GitHub에서 스캔용으로 가져올 파일 수/용량 예산.
const MAX_FILES = 8;
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
  ".json",
  ".env",
  ".yml",
  ".yaml",
  ".sh",
];
const IGNORED_PATH_PATTERN = /(^|\/)(node_modules|dist|build|vendor|\.git)\//;

type GithubTreeEntry = { path: string; type: string; size?: number };

export class GithubFetchError extends Error {}

export function parseGithubUrl(
  githubUrl: string
): { owner: string; repo: string } | null {
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
export async function fetchGithubScannableFiles(
  githubUrl: string
): Promise<ScannableFile[]> {
  const parsed = parseGithubUrl(githubUrl);
  if (!parsed) {
    throw new GithubFetchError(
      "GitHub 저장소 링크를 인식하지 못했습니다. https://github.com/owner/repo 형태인지 확인해주세요."
    );
  }
  const { owner, repo } = parsed;

  const repoInfo = await githubFetchJson<{ default_branch: string }>(
    `/repos/${owner}/${repo}`
  );
  if (!repoInfo) {
    throw new GithubFetchError(
      "저장소를 찾을 수 없습니다. 저장소가 존재하고 공개(public) 상태인지 확인해주세요."
    );
  }

  const tree = await githubFetchJson<{ tree: GithubTreeEntry[] }>(
    `/repos/${owner}/${repo}/git/trees/${encodeURIComponent(repoInfo.default_branch)}?recursive=1`
  );
  if (!tree) {
    throw new GithubFetchError("저장소 파일 목록을 가져오지 못했습니다.");
  }

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

  const files: ScannableFile[] = [];
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
