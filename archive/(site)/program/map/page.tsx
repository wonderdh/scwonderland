import type { Metadata } from "next";
import Image from "next/image";

export const metadata: Metadata = {
  title: "MAP | 원더랜드 영어학원",
  description: "원더랜드 영어학원 프로그램 MAP",
};

export default function MapPage() {
  return (
    <section className="bg-white py-16 md:py-24">
      <div className="container mx-auto px-4">
        <div className="mx-auto max-w-6xl">
          {/* 데스크톱: 왼쪽 글 · 오른쪽 이미지 / 모바일: 글 위 → 이미지 아래 */}
          <div className="flex flex-col gap-10 md:flex-row md:items-flex-start md:gap-12">
            <div className="shrink-0 md:w-[320px] md:max-w-[36%]">
              <h2 className="text-3xl font-extrabold text-gray-900 md:text-4xl">
                프로그램 MAP
              </h2>
              <p className="mt-6 whitespace-pre-line text-lg font-medium leading-relaxed text-gray-700 md:text-xl">
                지식 전달 학습과
                {"\n"}
                활동형 학생 주도 학습을
                {"\n"}
                이상적으로 조화한
                {"\n"}
                학습 커리큘럼
              </p>
            </div>

            <div className="min-w-0 flex-1">
              <p className="mb-4 flex items-center gap-2 text-sm text-gray-500 md:hidden">
                <span className="inline-block h-4 w-4 shrink-0 rounded-full border-2 border-gray-400" aria-hidden />
                좌우로 스크롤하여 전체 내용을 확인하실 수 있습니다.
              </p>
              <div className="overflow-x-auto overflow-y-hidden rounded-xl bg-gray-100">
                <Image
                  src="/images/program/map/map_img1.png"
                  alt="프로그램 MAP"
                  width={783}
                  height={1555}
                  className="h-auto w-full max-w-none object-contain"
                  sizes="(max-width: 768px) 100vw, 64rem"
                />
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
