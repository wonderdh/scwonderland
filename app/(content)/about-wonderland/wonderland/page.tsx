import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Wonderland | 원더랜드 영어학원",
  description: "원더랜드 영어학원 Wonderland - 왜 다른가요?",
};

/** 이미지는 public/images/about-wonderland/wonderland/ 에 넣으시면 됩니다. */
const WONDERLAND_IMAGES = [
  { src: "/images/about-wonderland/wonderland/wonderland1.png", alt: "Whole Language Approach" },
  { src: "/images/about-wonderland/wonderland/wonderland2.png", alt: "Communicative Language Teaching" },
  { src: "/images/about-wonderland/wonderland/wonderland3.png", alt: "Content-based Instruction" },
];

export default function WonderlandPage() {
  return (
    <section className="bg-white">
      {/* top */}
      <div className="bg-gray-50 py-16 md:py-24">
        <div className="container mx-auto px-4">
          <div className="mx-auto max-w-4xl">
            <div className="text-center">
              <p className="text-lg text-gray-900 md:text-xl">
                Why is Wonderland different?
              </p>
              <h1 className="mt-4 text-3xl font-extrabold leading-tight text-gray-900 md:text-5xl">
                Wonderland는
                <br />
                <span className="text-[#52b978]">왜 다른가요?</span>
              </h1>
            </div>
            <p className="mt-8 border-b border-[#52b978] pb-6 text-center text-lg font-medium leading-relaxed text-gray-800 md:text-xl">
              주니어 영어 교육의 선두주자로 탄탄한 수업구성과 교수방법을 갖추고
              있습니다.
              <br />
              교사의 일방적인 수업이 아닌 학습자 중심의 수업을 지향합니다.
            </p>
          </div>
        </div>
      </div>

      {/* list: 3 boxes */}
      <div className="py-16 md:py-24">
        <div className="container mx-auto px-4">
          <div className="mx-auto max-w-6xl space-y-20 md:space-y-28">
            {/* 01 - 텍스트 왼쪽, 이미지 오른쪽 */}
            <div className="grid gap-10 md:grid-cols-2 md:items-center">
              <div>
                <em className="text-2xl font-extrabold text-gray-300 md:text-3xl">
                  01
                </em>
                <h2 className="mt-4 text-2xl font-bold leading-snug text-gray-900 md:text-3xl">
                  <span className="text-[#ff7700]">Whole Language Approach</span>
                  <br />
                  총체적 언어 접근법
                </h2>
                <p className="mt-6 text-gray-600 md:text-lg">
                  통합적인 언어기능에 초점을 두어 말하기, 듣기, 읽기, 쓰기를
                  고루 발달시킵니다.
                </p>
              </div>
              <div className="relative aspect-video overflow-hidden rounded-xl bg-gray-100">
                {/* 이미지 추가 시 public/images/about-wonderland/wonderland/wonderland1.png */}
                <img
                  src={WONDERLAND_IMAGES[0].src}
                  alt={WONDERLAND_IMAGES[0].alt}
                  className="h-full w-full object-cover"
                />
              </div>
            </div>

            {/* 02 - 이미지 왼쪽, 텍스트 오른쪽 */}
            <div className="grid gap-10 md:grid-cols-2 md:items-center">
              <div className="relative aspect-video overflow-hidden rounded-xl bg-gray-100 md:order-2">
                <img
                  src={WONDERLAND_IMAGES[1].src}
                  alt={WONDERLAND_IMAGES[1].alt}
                  className="h-full w-full object-cover"
                />
              </div>
              <div className="md:order-1">
                <em className="text-2xl font-extrabold text-gray-300 md:text-3xl">
                  02
                </em>
                <h2 className="mt-4 text-2xl font-bold leading-snug text-gray-900 md:text-3xl">
                  <span className="text-[#52b978]">
                    Communicative Language Teaching
                  </span>
                  <br />
                  의사소통 언어 교육
                </h2>
                <p className="mt-6 text-gray-600 md:text-lg">
                  학습에 그치지 않고 실제로 의사소통이 가능하고 상황에 맞게
                  언어를 사용하도록 지도합니다.
                </p>
              </div>
            </div>

            {/* 03 - 텍스트 왼쪽, 이미지 오른쪽 */}
            <div className="grid gap-10 md:grid-cols-2 md:items-center">
              <div>
                <em className="text-2xl font-extrabold text-gray-300 md:text-3xl">
                  03
                </em>
                <h2 className="mt-4 text-2xl font-bold leading-snug text-gray-900 md:text-3xl">
                  <span className="text-[#3a75ff]">Content-based Instruction</span>
                  <br />
                  내용 중심 접근법
                </h2>
                <p className="mt-6 text-gray-600 md:text-lg">
                  다양한 주제의 내용들을 제 2외국어인 영어로 습득하게 합니다.
                </p>
              </div>
              <div className="relative aspect-video overflow-hidden rounded-xl bg-gray-100">
                <img
                  src={WONDERLAND_IMAGES[2].src}
                  alt={WONDERLAND_IMAGES[2].alt}
                  className="h-full w-full object-cover"
                />
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* banner */}
      <div className="bg-[#52b978] py-16 text-white md:py-24">
        <div className="container mx-auto px-4 text-center">
          <h3 className="text-2xl font-bold md:text-4xl">
            <span className="text-white">아이들의 눈높이에 맞게 디자인</span>
            된 수업을 통하여
          </h3>
          <p className="mx-auto mt-6 max-w-3xl text-lg leading-relaxed opacity-95 md:text-xl">
            새로운 언어에 대한 흥미를 더하고 스스로 동기를 유발하도록 이끌어
            주어
            <br className="hidden md:inline" />
            쉽고 자연스럽게 발화하고 자신감을 갖도록 지도합니다.
          </p>
        </div>
      </div>

      {/* txt */}
      <div className="py-16 text-center md:py-24">
        <div className="container mx-auto px-4">
          <h3 className="text-xl font-extrabold text-gray-900 md:text-2xl">
            외우는 영어가 아닙니다.
          </h3>
          <h2 className="mt-4 text-2xl font-semibold leading-snug text-gray-900 md:text-4xl">
            <strong>
              <span className="text-[#ff7700]">보고</span>,{" "}
              <span className="text-[#3a75ff]">듣고</span>,{" "}
              <span className="text-[#52b978]">활동</span> 하면서
            </strong>
            <br />
            배우는 영어입니다.
          </h2>
        </div>
      </div>
    </section>
  );
}
