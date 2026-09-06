import "server-only";
import yauzl from "yauzl";
import type { ScannableFile } from "./scannableFile";

// 업로드된 zip 자체의 최대 크기
export const MAX_ZIP_UPLOAD_BYTES = 20 * 1024 * 1024; // 20MB
// zip 안에 들어있을 수 있는 최대 엔트리(파일+폴더) 수
const MAX_ENTRIES = 2000;
// 스캔 대상으로 읽어올 파일 1개의 최대 크기
const MAX_FILE_BYTES = 512 * 1024; // 512KB
// 스캔을 위해 메모리에 올리는 전체 텍스트 총량 예산
const MAX_TOTAL_BYTES = 20 * 1024 * 1024; // 20MB
// 이보다 큰 "선언된" 압축 해제 크기를 가진 엔트리가 하나라도 있으면
// 압축 폭탄으로 간주하고 업로드 전체를 거부한다.
const SUSPICIOUS_DECLARED_SIZE = 200 * 1024 * 1024; // 200MB

const SCANNABLE_EXTENSIONS = [
  ".ts",
  ".tsx",
  ".js",
  ".jsx",
  ".mjs",
  ".cjs",
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
const IGNORED_PATH_PATTERN =
  /(^|\/)(node_modules|\.git|dist|build|vendor|__pycache__|\.venv)\//i;

export class ZipValidationError extends Error {}

// 기본값은 운영에서 쓰는 상한 그대로이고, 테스트에서만 작은 값으로 덮어써서
// "예산 초과" 경계 상황을 거대한 zip 픽스처 없이 재현할 수 있게 한다.
export type ExtractOptions = {
  maxFileBytes?: number;
  maxTotalBytes?: number;
};

// 경로 조작(Zip Slip) 방어: 절대경로, 드라이브 문자, ".." 세그먼트를 모두 거부한다.
function isSafeRelativePath(rawPath: string): boolean {
  const normalized = rawPath.replace(/\\/g, "/");
  if (normalized.startsWith("/") || /^[a-zA-Z]:/.test(normalized)) return false;
  const segments = normalized.split("/");
  return !segments.some((segment) => segment === "..");
}

// zip 엔트리의 유닉스 외부 속성 상위 16비트가 파일 모드다. 심볼릭 링크는 S_IFLNK(0xA000).
function isSymlinkEntry(entry: yauzl.Entry): boolean {
  const unixMode = entry.externalFileAttributes >>> 16;
  return (unixMode & 0xf000) === 0xa000;
}

function isScannablePath(entryPath: string): boolean {
  if (IGNORED_PATH_PATTERN.test(entryPath)) return false;
  const baseName = entryPath.split("/").pop() ?? "";
  if (/^readme(\.md)?$/i.test(baseName)) return true;
  return SCANNABLE_EXTENSIONS.some((ext) => baseName.toLowerCase().endsWith(ext));
}

// 스트림에서 읽는 실제 바이트 수를 직접 세어, 선언된 크기를 속인 압축 폭탄도
// 상한을 넘는 즉시 스트림을 파괴해 방어한다 (선언값만 믿지 않는다).
function readEntryWithHardLimit(
  zipfile: yauzl.ZipFile,
  entry: yauzl.Entry,
  limitBytes: number
): Promise<string> {
  return new Promise((resolve, reject) => {
    zipfile.openReadStream(entry, (err, stream) => {
      if (err || !stream) {
        reject(err ?? new Error("스트림을 열지 못했습니다."));
        return;
      }

      const chunks: Buffer[] = [];
      let bytesRead = 0;

      stream.on("data", (chunk: Buffer) => {
        bytesRead += chunk.length;
        if (bytesRead > limitBytes) {
          stream.destroy(new Error("파일 크기가 제한을 초과했습니다."));
          return;
        }
        chunks.push(chunk);
      });
      stream.on("end", () => resolve(Buffer.concat(chunks).toString("utf-8")));
      stream.on("error", (streamError) => reject(streamError));
    });
  });
}

// zip 파일에서 스캔 대상 텍스트 파일만 안전하게 읽어온다.
// - 절대 디스크에 쓰지 않는다 (메모리에서만 처리).
// - 절대 코드를 실행하지 않는다 (설치/빌드/스크립트 실행 없음).
// - Zip Slip, 심볼릭 링크, 압축 폭탄을 방어한다.
export async function extractScannableFiles(
  zipBuffer: Buffer,
  options: ExtractOptions = {}
): Promise<ScannableFile[]> {
  const maxFileBytes = options.maxFileBytes ?? MAX_FILE_BYTES;
  const maxTotalBytes = options.maxTotalBytes ?? MAX_TOTAL_BYTES;

  if (zipBuffer.length === 0) {
    throw new ZipValidationError("빈 파일입니다.");
  }
  if (zipBuffer.length > MAX_ZIP_UPLOAD_BYTES) {
    throw new ZipValidationError(
      `zip 파일이 너무 큽니다 (최대 ${MAX_ZIP_UPLOAD_BYTES / 1024 / 1024}MB).`
    );
  }

  let zipfile: yauzl.ZipFile;
  try {
    zipfile = await yauzl.fromBufferPromise(zipBuffer, {
      lazyEntries: true,
      strictFileNames: true,
      validateEntrySizes: true,
    });
  } catch {
    throw new ZipValidationError("올바른 zip 파일이 아닙니다.");
  }

  try {
    if (zipfile.entryCount > MAX_ENTRIES) {
      throw new ZipValidationError(
        `zip 안의 파일 수가 너무 많습니다 (최대 ${MAX_ENTRIES}개).`
      );
    }

    const files: ScannableFile[] = [];
    let totalBytes = 0;

    for await (const entry of zipfile.eachEntry()) {
      const isDirectory = entry.fileName.endsWith("/");
      if (isDirectory) continue;

      if (!isSafeRelativePath(entry.fileName)) {
        throw new ZipValidationError(
          `허용되지 않는 경로가 포함되어 있습니다: ${entry.fileName}`
        );
      }
      if (isSymlinkEntry(entry)) {
        throw new ZipValidationError(
          `심볼릭 링크는 허용되지 않습니다: ${entry.fileName}`
        );
      }
      if (entry.isEncrypted()) {
        throw new ZipValidationError(
          `암호로 보호된 zip은 지원하지 않습니다: ${entry.fileName}`
        );
      }
      if (entry.uncompressedSize > SUSPICIOUS_DECLARED_SIZE) {
        throw new ZipValidationError(
          "압축을 해제하면 비정상적으로 큰 용량이 되는 파일이 포함되어 있습니다."
        );
      }

      if (!isScannablePath(entry.fileName)) continue;
      // 스캔 대상이 아닌 큰 파일은 조용히 건너뛴다 (거부하지 않음).
      if (entry.uncompressedSize > maxFileBytes) continue;
      if (totalBytes >= maxTotalBytes) break;

      const remaining = maxTotalBytes - totalBytes;
      let content: string;
      try {
        content = await readEntryWithHardLimit(
          zipfile,
          entry,
          Math.min(maxFileBytes, remaining)
        );
      } catch (error) {
        if (error instanceof ZipValidationError) throw error;
        throw new ZipValidationError(
          `압축을 해제하는 중 문제가 발생했습니다 (선언된 크기와 실제 내용이 다를 수 있습니다): ${entry.fileName}`
        );
      }
      // 문자열 길이(.length)는 UTF-16 코드 유닛 수라 한글 등 멀티바이트 문자에서
      // 실제 바이트 수를 최대 3배까지 과소 계산한다. 예산은 실제 바이트로 잰다.
      totalBytes += Buffer.byteLength(content, "utf-8");
      files.push({ path: entry.fileName, content });
    }

    return files;
  } finally {
    zipfile.close();
  }
}
