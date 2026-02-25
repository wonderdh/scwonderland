import type { Metadata } from "next";
import { PageContent } from "@/app/(site)/_components/sections/PageContent";

export const metadata: Metadata = {
  title: "Library | 원더랜드 영어학원",
  description: "원더랜드 영어학원 Library",
};

export default function LibraryPage() {
  return (
    <PageContent title="Library">
      <p>Library 콘텐츠 영역입니다.</p>
    </PageContent>
  );
}
