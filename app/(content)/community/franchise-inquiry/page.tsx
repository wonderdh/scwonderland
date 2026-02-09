import type { Metadata } from "next";
import { PageContent } from "@/app/components/sections/PageContent";

export const metadata: Metadata = {
  title: "가맹문의 | 원더랜드 영어학원",
  description: "원더랜드 영어학원 가맹문의",
};

export default function FranchiseInquiryPage() {
  return (
    <PageContent title="가맹문의">
      <p>가맹문의 콘텐츠 영역입니다.</p>
    </PageContent>
  );
}
