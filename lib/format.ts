export function formatPrice(price: number): string {
  return `${price.toLocaleString("ko-KR")}원`;
}

// 금액 입력란 전용 - 콤마 없는 숫자 문자열을 입력 중에 보여줄 천단위 콤마
// 문자열로 바꾼다("원" 접미사는 붙이지 않는다, 최종 표시엔 formatPrice를 쓴다).
export function formatAmountInput(rawDigits: string): string {
  if (!rawDigits) return "";
  return Number(rawDigits).toLocaleString("ko-KR");
}

// 사용자가 입력하거나 붙여넣은 값에서 숫자만 남긴다 - "30,000원", " 30000 " 등
// 어떤 형태로 들어와도 순수 숫자 문자열로 정리한다.
export function parseAmountInput(value: string): string {
  return value.replace(/[^0-9]/g, "");
}

// 프로필 사진은 private Blob에 저장되어 있어 프록시 라우트(app/api/profile/image)를
// 거쳐야 브라우저에서 볼 수 있다. Blob URL 끝의 랜덤 suffix를 캐시 무효화 쿼리로
// 붙여, 사진을 교체해도 브라우저가 이전 캐시를 계속 보여주지 않게 한다.
export function getProfileImageSrc(
  sellerId: string,
  profileImageUrl: string | null
): string | null {
  if (!profileImageUrl) return null;
  const version = profileImageUrl.split("/").pop() ?? "";
  return `/api/profile/image/${sellerId}?v=${encodeURIComponent(version)}`;
}

export function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("ko-KR", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}
