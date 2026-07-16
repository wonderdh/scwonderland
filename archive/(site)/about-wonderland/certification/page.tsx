import type { Metadata } from "next";
import { PageContent } from "@/app/(site)/_components/sections/PageContent";

export const metadata: Metadata = {
  title: "대외기관 인증 | 원더랜드 영어학원",
  description: "원더랜드 영어학원 대외기관 인증",
};

export default function CertificationPage() {
  return (
    <PageContent title="대외기관 인증">
      <p>대외기관 인증 콘텐츠 영역입니다.</p>
    </PageContent>
  );
}
