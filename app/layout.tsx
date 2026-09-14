import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { SiteHeader } from "./_components/SiteHeader";
import { SiteFooter } from "./_components/SiteFooter";
import { AuthStatus } from "./_components/AuthStatus";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const SITE_TITLE = "툴허브 - 바이브코딩 자동화 봇 거래 허브";
const SITE_DESCRIPTION =
  "필요한 업무를 설명하면 제작자가 가격과 기간을 제안합니다. 완성본은 전달 전 자동 보안 스캔을 거칩니다. 의뢰자와 제작자를 잇는 자동화 툴 플랫폼, 툴허브.";

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL ?? "https://tool-hub-olive.vercel.app"),
  title: SITE_TITLE,
  description: SITE_DESCRIPTION,
  openGraph: {
    title: SITE_TITLE,
    description: SITE_DESCRIPTION,
    siteName: "툴허브",
    locale: "ko_KR",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: SITE_TITLE,
    description: SITE_DESCRIPTION,
  },
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="ko"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="flex min-h-full flex-col bg-white text-zinc-900 dark:bg-black dark:text-zinc-50">
        <SiteHeader authStatus={<AuthStatus />} />
        {children}
        <SiteFooter />
      </body>
    </html>
  );
}
