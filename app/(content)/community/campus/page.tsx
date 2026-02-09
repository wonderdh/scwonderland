import type { Metadata } from "next";
import { PageContent } from "@/app/components/sections/PageContent";

export const metadata: Metadata = {
  title: "캠퍼스 | 원더랜드 영어학원",
  description: "원더랜드 영어학원 캠퍼스",
};

export default function CampusPage() {
  return (
    <PageContent title="캠퍼스">
      <p>캠퍼스 콘텐츠 영역입니다.</p>
    </PageContent>
  );
}
