"use client";

import { useRef, useState } from "react";
import type { SourceType } from "@/lib/types";

// lib/zipExtract.ts의 MAX_ZIP_UPLOAD_BYTES와 반드시 같은 값이어야 한다(그쪽은
// "server-only" 모듈이라 클라이언트 컴포넌트에서 import할 수 없다). 여기서는
// 선택 즉시 초과분을 걸러 업로드 자체를 막는 용도이고, 실제 검증은 서버(app/actions.ts)
// 에서 다시 한다 - 이 값은 UX 보조일 뿐 보안 경계가 아니다.
const MAX_ZIP_UPLOAD_BYTES = 50 * 1024 * 1024;
const MAX_ZIP_UPLOAD_MB = MAX_ZIP_UPLOAD_BYTES / 1024 / 1024;

export function SourceTypeFields({
  defaultCodeUrl,
}: {
  defaultCodeUrl?: string;
}) {
  const [sourceType, setSourceType] = useState<SourceType>("github");
  const [zipSizeError, setZipSizeError] = useState<string | null>(null);
  const zipInputRef = useRef<HTMLInputElement>(null);

  function handleZipFileChange(file: File | null) {
    if (file && file.size > MAX_ZIP_UPLOAD_BYTES) {
      setZipSizeError(`zip 파일은 최대 ${MAX_ZIP_UPLOAD_MB}MB까지 업로드할 수 있습니다.`);
      // 선택된 파일을 즉시 지워 이 상태로는 제출 자체가 되지 않게 한다
      // (required 속성 때문에 빈 입력으로는 폼 제출이 막힌다).
      if (zipInputRef.current) zipInputRef.current.value = "";
      return;
    }
    setZipSizeError(null);
  }

  return (
    <div className="flex flex-col gap-3">
      <span className="text-sm font-medium">코드 입력 방식</span>
      <div className="flex gap-4 text-sm">
        <label className="flex items-center gap-2">
          <input
            type="radio"
            name="sourceType"
            value="github"
            checked={sourceType === "github"}
            onChange={() => setSourceType("github")}
          />
          GitHub 저장소 링크
        </label>
        <label className="flex items-center gap-2">
          <input
            type="radio"
            name="sourceType"
            value="zip"
            checked={sourceType === "zip"}
            onChange={() => setSourceType("zip")}
          />
          zip 파일 업로드
        </label>
      </div>
      <div className="flex flex-col gap-0.5 text-xs text-zinc-500 dark:text-zinc-400">
        <p>
          완성본은 하나의 zip 파일로 제출해 주세요. 파일이 여러 개면 압축해서 하나로
          올리면 됩니다.
        </p>
        <p>최대 용량 50MB. 더 큰 경우 GitHub 링크로 제출해 주세요.</p>
      </div>

      {sourceType === "github" ? (
        <input
          name="codeUrl"
          type="url"
          required
          defaultValue={defaultCodeUrl}
          placeholder="https://github.com/your-id/your-repo"
          className="rounded-lg border border-zinc-300 px-3 py-2 text-sm outline-none focus:border-zinc-500 dark:border-zinc-700 dark:bg-zinc-900"
        />
      ) : (
        <div className="flex flex-col gap-1.5">
          <input
            ref={zipInputRef}
            name="zipFile"
            type="file"
            accept=".zip,application/zip"
            required
            onChange={(event) => handleZipFileChange(event.target.files?.[0] ?? null)}
            className="rounded-lg border border-zinc-300 px-3 py-2 text-sm outline-none file:mr-3 file:rounded-md file:border-0 file:bg-zinc-100 file:px-3 file:py-1.5 file:text-sm dark:border-zinc-700 dark:bg-zinc-900 dark:file:bg-zinc-800"
          />
          {zipSizeError ? (
            <p className="text-xs font-medium text-red-600 dark:text-red-400">{zipSizeError}</p>
          ) : (
            <p className="text-xs text-zinc-500 dark:text-zinc-400">
              업로드된 코드는 스캔에만 사용되며 서버에 저장/실행되지 않습니다.
            </p>
          )}
        </div>
      )}
    </div>
  );
}
