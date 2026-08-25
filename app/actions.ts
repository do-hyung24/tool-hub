"use server";

import { redirect } from "next/navigation";
import { after } from "next/server";
import { addListing, updateListingScanResult } from "@/lib/data";
import { scanRepository } from "@/lib/scan";
import { CATEGORIES, type Category } from "@/lib/types";

export async function createListingAction(formData: FormData) {
  const title = String(formData.get("title") ?? "").trim();
  const description = String(formData.get("description") ?? "").trim();
  const price = Number(formData.get("price"));
  const category = String(formData.get("category") ?? "");
  const codeUrl = String(formData.get("codeUrl") ?? "").trim();

  if (!title || !description || !codeUrl) {
    throw new Error("제목, 설명, 코드 링크는 필수입니다.");
  }
  if (!Number.isFinite(price) || price < 0) {
    throw new Error("가격을 올바르게 입력해주세요.");
  }
  if (!CATEGORIES.includes(category as Category)) {
    throw new Error("카테고리를 선택해주세요.");
  }

  const listing = await addListing({
    title,
    description,
    price,
    category: category as Category,
    codeUrl,
  });

  // 스캔은 시간이 걸리므로 응답 전송 후 백그라운드에서 실행하고,
  // 사용자는 우선 "스캔 중" 상태의 상세 페이지로 이동한다.
  after(async () => {
    const scanResult = await scanRepository(listing.codeUrl);
    await updateListingScanResult(listing.id, scanResult);
  });

  redirect(`/listings/${listing.id}`);
}
