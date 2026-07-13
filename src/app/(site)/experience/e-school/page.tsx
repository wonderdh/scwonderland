import type { Metadata } from "next";
import { PageContent } from "@/app/(site)/_components/sections/PageContent";

export const metadata: Metadata = {
  title: "Wonderland E-Learning | 원더랜드 영어학원",
  description: "원더랜드 영어학원 Wonderland E-Learning",
};

export default function ESchoolPage() {
  return (
    <PageContent title="Wonderland E-Learning">
      <p>Wonderland E-Learning 콘텐츠 영역입니다.</p>
    </PageContent>
  );
}
