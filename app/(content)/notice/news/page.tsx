import type { Metadata } from "next";
import { PageContent } from "@/app/components/sections/PageContent";

export const metadata: Metadata = {
  title: "News | 원더랜드 영어학원",
  description: "원더랜드 영어학원 News",
};

export default function NewsPage() {
  return (
    <PageContent title="News">
      <p>News 콘텐츠 영역입니다. 준비 중입니다.</p>
    </PageContent>
  );
}
