"use client";

import { useState } from "react";
import { PriceField, type PricingType } from "./PriceField";
import { SourceTypeFields } from "./SourceTypeFields";

// 가격(무료/유료)과 코드 입력 방식이 서로 영향을 주기 때문에(유료 → zip
// 업로드 강제) 두 필드를 한 컴포넌트에서 같은 state로 묶는다.
export function ListingFormFields({
  settlementAccountExists,
  defaultCodeUrl,
}: {
  settlementAccountExists: boolean;
  defaultCodeUrl?: string;
}) {
  const [pricingType, setPricingType] = useState<PricingType>("paid");
  const [price, setPrice] = useState("");

  return (
    <>
      <PriceField
        pricingType={pricingType}
        onPricingTypeChange={setPricingType}
        price={price}
        onPriceChange={setPrice}
        settlementAccountExists={settlementAccountExists}
      />
      <SourceTypeFields defaultCodeUrl={defaultCodeUrl} forceZip={pricingType === "paid"} />
    </>
  );
}
