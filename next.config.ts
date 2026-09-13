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
  // 보안 감사 라운드1: CSP는 여기 포함하지 않는다(다음 라운드에서 별도로
  // 다룬다 - 잘못 잡으면 사이트가 조용히 깨질 수 있어 신중히 접근한다).
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          // 이 사이트를 iframe에 넣는 것을 전면 차단한다(클릭재킹 방어).
          { key: "X-Frame-Options", value: "DENY" },
          // 브라우저가 선언된 Content-Type을 무시하고 응답 본문을 추측해
          // 다른 타입으로 실행하는 것을 막는다.
          { key: "X-Content-Type-Options", value: "nosniff" },
          // 다른 사이트로 이동할 때 origin까지만 보내고 전체 경로/쿼리는
          // 보내지 않는다(같은 출처 안에서는 전체 URL 유지).
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          // 이 서비스가 쓰지 않는 브라우저 기능을 명시적으로 꺼둔다.
          {
            key: "Permissions-Policy",
            value:
              "camera=(), microphone=(), geolocation=(), payment=(), usb=(), magnetometer=(), gyroscope=(), interest-cohort=()",
          },
        ],
      },
    ];
  },
};

export default nextConfig;
