"use client";

import { useState } from "react";

// SourceTypeFields와 같은 패턴 - 라디오로 무료/유료를 나누고, 유료일 때만
// 가격 입력을 보여준다. 무료를 선택하면 price 필드 자체가 폼에 없으므로
// 서버(createListingAction)는 pricingType이 "free"면 가격을 0으로 저장한다.
export function PriceField({ defaultPrice }: { defaultPrice?: string }) {
  const [pricingType, setPricingType] = useState<"paid" | "free">("paid");

  return (
    <div className="flex flex-col gap-1.5">
      <span className="text-sm font-medium">가격</span>
      <div className="flex gap-4 text-sm">
        <label className="flex items-center gap-2">
          <input
            type="radio"
            name="pricingType"
            value="paid"
            checked={pricingType === "paid"}
            onChange={() => setPricingType("paid")}
          />
          유료
        </label>
        <label className="flex items-center gap-2">
          <input
            type="radio"
            name="pricingType"
            value="free"
            checked={pricingType === "free"}
            onChange={() => setPricingType("free")}
          />
          무료로 공개
        </label>
      </div>

      {pricingType === "paid" && (
        <input
          id="price"
          name="price"
          type="number"
          min={1}
          step={1000}
          required
          defaultValue={defaultPrice}
          placeholder="30000"
          className="rounded-lg border border-zinc-300 px-3 py-2 text-sm outline-none focus:border-zinc-500 dark:border-zinc-700 dark:bg-zinc-900"
        />
      )}

      <p className="text-xs text-zinc-500 dark:text-zinc-400">
        무료로 공개한 툴은 프로필에 표시되어, 의뢰자가 제안을 비교할 때 실력을 가늠하는
        자료가 됩니다.
      </p>
    </div>
  );
}
