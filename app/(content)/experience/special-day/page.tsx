import type { Metadata } from "next";
import { PageContent } from "@/app/components/sections/PageContent";

export const metadata: Metadata = {
  title: "Special Day | 원더랜드 영어학원",
  description: "원더랜드 영어학원 Special Day",
};

export default function SpecialDayPage() {
  return (
    <PageContent title="Special Day">
      <p>Special Day 콘텐츠 영역입니다.</p>
    </PageContent>
  );
}
