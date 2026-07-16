import type { Metadata } from "next";
import { PageContent } from "@/app/(site)/_components/sections/PageContent";

export const metadata: Metadata = {
  title: "학부모상담 | 원더랜드 영어학원",
  description: "원더랜드 영어학원 학부모상담",
  // 비활성화 상태: 검색엔진 색인 제외
  robots: { index: false, follow: false },
};

export default function ParentConsultationPage() {
  return (
    <PageContent title="학부모상담">
      <p className="py-12 text-center text-gray-500">
        온라인 상담 신청은 현재 준비 중입니다. 전화로 문의해 주세요.
      </p>
    </PageContent>
  );
}
