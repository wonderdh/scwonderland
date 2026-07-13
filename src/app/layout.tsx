import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { Toaster } from "sonner";
import { NavigationProgress } from "@/components/feedback/NavigationProgress";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const BASE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "https://scwonderland.com";

export const metadata: Metadata = {
  metadataBase: new URL(BASE_URL),
  title: {
    default: "원더랜드 영어학원",
    template: "%s | 원더랜드 영어학원",
  },
  description:
    "유아부터 초등학생까지, 아이들의 영어 실력과 자신감을 키워주는 영어 전문 교육기관",
  keywords: [
    "영어학원", "원더랜드", "유치부영어", "초등영어",
    "어린이영어", "순천영어학원", "Wonderland",
  ],
  openGraph: {
    title: "원더랜드 영어학원",
    description:
      "유아부터 초등학생까지, 아이들의 영어 실력과 자신감을 키워주는 영어 전문 교육기관",
    siteName: "원더랜드 영어학원",
    locale: "ko_KR",
    type: "website",
    images: [
      {
        url: "/sc-wonderland-logo.png",
        width: 512,
        height: 512,
        alt: "원더랜드 영어학원 로고",
      },
    ],
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ko" className="scroll-smooth" data-scroll-behavior="smooth">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        <NavigationProgress />
        {children}
        <Toaster position="top-center" richColors duration={2000} />
      </body>
    </html>
  );
}
