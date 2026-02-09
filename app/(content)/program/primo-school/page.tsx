import type { Metadata } from "next";
import { PageContent } from "@/app/components/sections/PageContent";

export const metadata: Metadata = {
  title: "Primo School | 원더랜드 영어학원",
  description: "원더랜드 영어학원 Primo School",
};

export default function PrimoSchoolPage() {
  return (
    <PageContent title="Primo School">
      <p>Primo School 콘텐츠 영역입니다.</p>
    </PageContent>
  );
}
