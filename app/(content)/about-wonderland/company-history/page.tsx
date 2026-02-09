import type { Metadata } from "next";
import { PageContent } from "@/app/components/sections/PageContent";

export const metadata: Metadata = {
  title: "회사연혁 | 원더랜드 영어학원",
  description: "원더랜드 영어학원 회사연혁",
};

export default function CompanyHistoryPage() {
  return (
    <PageContent title="회사연혁">
      <p>회사연혁 콘텐츠 영역입니다. 원더랜드의 발자취를 소개합니다.</p>
    </PageContent>
  );
}
