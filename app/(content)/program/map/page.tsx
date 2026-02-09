import type { Metadata } from "next";
import { PageContent } from "@/app/components/sections/PageContent";

export const metadata: Metadata = {
  title: "MAP | 원더랜드 영어학원",
  description: "원더랜드 영어학원 MAP",
};

export default function MapPage() {
  return (
    <PageContent title="MAP">
      <p>MAP 콘텐츠 영역입니다.</p>
    </PageContent>
  );
}
