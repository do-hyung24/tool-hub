import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    serverActions: {
      // Server Actions 기본 요청 본문 상한은 1MB라, lib/zipExtract.ts의
      // MAX_ZIP_UPLOAD_BYTES(50MB)를 올려도 이 값을 함께 올리지 않으면 zip이
      // 앱 코드에 닿기도 전에 Next.js가 먼저 거부한다. 완성본 제출 폼은 zip(최대
      // 50MB) + 작동 증빙 스크린샷(최대 5장 × 2MB) + 작동 증빙 영상(최대 20MB)을
      // 한 번에 같은 폼으로 제출하므로, 그 합(약 80MB)보다 여유 있게 잡는다.
      bodySizeLimit: "85mb",
    },
  },
};

export default nextConfig;
