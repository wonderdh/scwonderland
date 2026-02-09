import type { Metadata } from "next";
import { GreetingContent } from "@/app/components/sections/GreetingContent";

export const metadata: Metadata = {
  title: "인사말 | 원더랜드 영어학원",
  description: "원더랜드 영어학원 인사말 - Everyone Smiles in Wonderland",
};

export default function GreetingPage() {
  return <GreetingContent />;
}
