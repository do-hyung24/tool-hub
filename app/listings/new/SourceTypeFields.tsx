"use client";

import { useState } from "react";
import type { SourceType } from "@/lib/types";

export function SourceTypeFields({
  defaultCodeUrl,
}: {
  defaultCodeUrl?: string;
}) {
  const [sourceType, setSourceType] = useState<SourceType>("github");

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
            name="zipFile"
            type="file"
            accept=".zip,application/zip"
            required
            className="rounded-lg border border-zinc-300 px-3 py-2 text-sm outline-none file:mr-3 file:rounded-md file:border-0 file:bg-zinc-100 file:px-3 file:py-1.5 file:text-sm dark:border-zinc-700 dark:bg-zinc-900 dark:file:bg-zinc-800"
          />
          <p className="text-xs text-zinc-500 dark:text-zinc-400">
            업로드된 코드는 스캔에만 사용되며 서버에 저장/실행되지 않습니다.
          </p>
        </div>
      )}
    </div>
  );
}
