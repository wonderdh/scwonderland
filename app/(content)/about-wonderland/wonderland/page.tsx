import type { Metadata } from "next";
import { PageContent } from "@/app/components/sections/PageContent";

export const metadata: Metadata = {
  title: "Wonderland | 원더랜드 영어학원",
  description: "원더랜드 영어학원 Wonderland",
};

export default function WonderlandPage() {
  return (
    <PageContent title="Wonderland">
      <p>Wonderland 콘텐츠 영역입니다.</p>
    </PageContent>
  );
}
