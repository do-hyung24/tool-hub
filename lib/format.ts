export function formatPrice(price: number): string {
  return `${price.toLocaleString("ko-KR")}원`;
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
