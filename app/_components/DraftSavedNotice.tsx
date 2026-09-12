"use client";

import { useEffect, useState } from "react";
import { readLandingDraft } from "@/lib/landingDraft";

// 랜딩 폼에서 저장한 초안이 브라우저에 남아 있을 때만 안내 문구를 보여준다.
// 로그인/회원가입 화면과 의뢰 등록 미로그인 안내 화면에서 공용으로 쓴다.
export function DraftSavedNotice() {
  const [hasDraft, setHasDraft] = useState(false);

  useEffect(() => {
    setHasDraft(readLandingDraft() !== null);
  }, []);

  if (!hasDraft) return null;

  return (
    <p className="mt-4 rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-700 dark:bg-emerald-950 dark:text-emerald-400">
      작성하신 내용은 저장되어 있습니다. 로그인하거나 가입하면 이어서 등록할 수 있어요.
    </p>
  );
}
