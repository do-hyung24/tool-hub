"use client";

import Link from "next/link";

export type PricingType = "paid" | "free";

// pricingType은 부모(ListingFormFields)가 들고 있다 - 유료 선택 시 코드 입력
// 방식(SourceTypeFields)도 zip으로 강제해야 해서, 두 필드가 같은 상태를
// 공유해야 하기 때문이다.
export function PriceField({
  pricingType,
  onPricingTypeChange,
  settlementAccountExists,
  defaultPrice,
}: {
  pricingType: PricingType;
  onPricingTypeChange: (type: PricingType) => void;
  settlementAccountExists: boolean;
  defaultPrice?: string;
}) {
  const showSettlementWarning = pricingType === "paid" && !settlementAccountExists;

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
            onChange={() => onPricingTypeChange("paid")}
          />
          유료
        </label>
        <label className="flex items-center gap-2">
          <input
            type="radio"
            name="pricingType"
            value="free"
            checked={pricingType === "free"}
            onChange={() => onPricingTypeChange("free")}
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

      {showSettlementWarning && (
        <p className="rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-700 dark:bg-amber-950 dark:text-amber-400">
          유료로 등록하려면 먼저 정산계좌를 등록해야 합니다.{" "}
          <Link href="/account/settlement" className="font-medium underline" target="_blank">
            정산계좌 등록하기
          </Link>
        </p>
      )}

      <p className="text-xs text-zinc-500 dark:text-zinc-400">
        무료로 공개한 툴은 프로필에 표시되어, 의뢰자가 제안을 비교할 때 실력을 가늠하는
        자료가 됩니다.
      </p>
    </div>
  );
}
