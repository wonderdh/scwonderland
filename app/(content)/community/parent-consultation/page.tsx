import type { Metadata } from "next";
import { PageContent } from "@/app/components/sections/PageContent";

export const metadata: Metadata = {
  title: "학부모상담 | 원더랜드 영어학원",
  description: "원더랜드 영어학원 학부모상담",
};

export default function ParentConsultationPage() {
  return (
    <PageContent title="학부모상담">
      <p>학부모상담 콘텐츠 영역입니다.</p>
    </PageContent>
  );
}
