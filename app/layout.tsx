import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { SiteHeader } from "./_components/SiteHeader";
import { SiteFooter } from "./_components/SiteFooter";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "툴허브 - 바이브코딩 자동화 봇 거래 허브",
  description:
    "필요한 자동화 툴을 설명하면 제작자가 제안하고, 완성본은 전달 전에 자동 보안 스캔을 거칩니다. 비개발자를 위한 맞춤 자동화 의뢰 플랫폼, 툴허브.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="ko"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="flex min-h-full flex-col bg-white text-zinc-900 dark:bg-black dark:text-zinc-50">
        <SiteHeader />
        {children}
        <SiteFooter />
      </body>
    </html>
  );
}
