import type { Metadata } from "next";
import { PageContent } from "@/app/components/sections/PageContent";

export const metadata: Metadata = {
  title: "Quest Academy | 원더랜드 영어학원",
  description: "원더랜드 영어학원 Quest Academy",
};

export default function QuestAcademyPage() {
  return (
    <PageContent title="Quest Academy">
      <p>Quest Academy 콘텐츠 영역입니다.</p>
    </PageContent>
  );
}
