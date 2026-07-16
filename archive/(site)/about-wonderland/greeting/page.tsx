import type { Metadata } from "next";
import Image from "next/image";

export const metadata: Metadata = {
  title: "인사말 | 원더랜드 영어학원",
  description: "원더랜드 영어학원 인사말 - Everyone Smiles in Wonderland",
};


export default function GreetingPage() {
  return (
    <section className="bg-white py-16 md:py-24">
      <div className="container mx-auto px-4">
        <div className="mx-auto grid max-w-6xl gap-12 lg:grid-cols-[1fr_1fr] lg:items-center lg:gap-16">
          {/* 왼쪽: 텍스트 */}
          <div className="txt-box">
            <p className="mb-4 text-lg text-green-700 md:text-xl">
              Everyone Smiles in <span className="text-green-600 font-semibold">Wonderland</span>
            </p>
            <h2 className="mb-8 text-2xl font-bold leading-tight text-gray-900 md:text-3xl lg:text-4xl">
              원더랜드에 오면
              <br />
              아이들이 행복합니다.
            </h2>
            <div className="space-y-5 text-gray-700 leading-relaxed">
              <p>
                <span>
                  1993년 1호점 개원을 시작한 이후 원더랜드 전직원은 오로지
                  아이들의 미래를 위한 영어교육을 생각하고 있습니다.
                </span>
              </p>
              <p>
                <span>
                  원더랜드는 영어를 배우는 곳이 아니라 영어를 통해 언어로서의
                  교육을 받는 곳입니다. 교과서적인 학습영어가 아닌 살아있는
                  언어로서의 영어를 체득하고 사용할 수 있도록 교육합니다.
                </span>
              </p>
              <p>
                <span>
                  통합적 사고력, 바른 인성과 사회성 등을 골고루 발전시켜
                  &quot;글로벌리더&quot;라는 목표를 향해 성장할 수 있도록
                  최선을 다하겠습니다. 감사합니다.
                </span>
              </p>
            </div>
            <div className="mt-10 flex flex-wrap items-end gap-4 border-t border-gray-200 pt-8">
              <span className="text-sm text-gray-600">
                원더랜드 주식회사 대표이사 장철호
              </span>
              <Image
                src="/images/about-wonderland/greeting/sign.png"
                alt="대표이사 서명"
                width={140}
                height={48}
                className="h-10 w-auto object-contain"
              />
            </div>
          </div>

          {/* 오른쪽: 이미지 */}
          <div className="img-box relative flex justify-center lg:justify-end">
            <div className="relative w-full max-w-md">
              <div className="relative overflow-hidden rounded-lg">
                <div className="relative aspect-[4/3] w-full overflow-hidden bg-gray-100">
                  <Image
                    src="/images/about-wonderland/greeting/about_img.png"
                    alt="원더랜드에서 즐겁게 학습하는 아이들"
                    fill
                    className="object-cover"
                    sizes="(max-width: 1024px) 100vw, 50vw"
                    priority
                  />
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
