"use server";

import { redirect } from "next/navigation";
import { getCurrentSellerId } from "@/lib/session";
import { updateSellerSettlementAccount } from "@/lib/data";

// 휴대폰 본인인증·계좌 실명대조 API는 쓰지 않는다 - 본인이 직접 입력한 값을
// 그대로 저장한다. 셋 다 채우거나(등록/수정) 셋 다 비워서(등록 취소) 저장할 수
// 있고, 일부만 채운 채로 저장하는 것은 막는다 - 이체 단계에서 반쪽짜리 계좌
// 정보가 노출되는 것을 방지한다.
export async function updateSettlementAccountAction(formData: FormData) {
  const sellerId = await getCurrentSellerId();
  if (!sellerId) {
    redirect("/login");
  }

  const bankName = String(formData.get("bankName") ?? "").trim();
  const accountHolder = String(formData.get("accountHolder") ?? "").trim();
  const accountNumber = String(formData.get("accountNumber") ?? "").trim();

  const filledCount = [bankName, accountHolder, accountNumber].filter((value) => value !== "").length;
  if (filledCount !== 0 && filledCount !== 3) {
    throw new Error("은행명, 예금주명, 계좌번호를 모두 입력하거나 모두 비워주세요.");
  }

  await updateSellerSettlementAccount(sellerId, {
    bankName: bankName || null,
    accountHolder: accountHolder || null,
    accountNumber: accountNumber || null,
  });

  redirect("/account/settlement?saved=1");
}
