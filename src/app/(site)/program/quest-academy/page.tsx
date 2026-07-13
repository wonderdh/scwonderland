import type { Metadata } from "next";
import { PageContent } from "@/app/(site)/_components/sections/PageContent";

export const metadata: Metadata = {
  title: "Quest Class | 원더랜드 영어학원",
  description: "원더랜드 영어학원 Quest Class - 초등 고학년·중등 전문 프로그램",
  // 비활성화 상태: 검색엔진 색인 제외
  robots: { index: false, follow: false },
};

export default function QuestClassPage() {
  return (
    <PageContent title="Quest Class">
      <p className="py-12 text-center text-gray-500">
        해당 프로그램 안내는 현재 준비 중입니다.
      </p>
    </PageContent>
  );
}
