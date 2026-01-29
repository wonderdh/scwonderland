"use client";

import { ImageWithFallback } from "../common/ImageWithFallback";

const images = [
  {
    src: "https://images.unsplash.com/photo-1574132190990-cfd62178bb1c?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxjaGlsZHJlbiUyMGxlYXJuaW5nJTIwY2xhc3Nyb29tfGVufDF8fHx8MTc2OTE0MTg0OXww&ixlib=rb-4.1.0&q=80&w=1080&utm_source=figma&utm_medium=referral",
    alt: "교실 수업 모습",
    title: "즐거운 수업 시간",
  },
  {
    src: "https://images.unsplash.com/photo-1549737221-bef65e2604a6?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxraWRzJTIwcmVhZGluZyUyMGJvb2tzfGVufDF8fHx8MTc2OTAzMzUwN3ww&ixlib=rb-4.1.0&q=80&w=1080&utm_source=figma&utm_medium=referral",
    alt: "아이들이 책 읽는 모습",
    title: "영어 독서 시간",
  },
  {
    src: "https://images.unsplash.com/photo-1557734864-c78b6dfef1b1?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxjb2xvcmZ1bCUyMGNsYXNzcm9vbSUyMGFjdGl2aXRpZXN8ZW58MXx8fHwxNzY5MTQzMzYyfDA&ixlib=rb-4.1.0&q=80&w=1080&utm_source=figma&utm_medium=referral",
    alt: "다양한 활동",
    title: "창의적 활동",
  },
  {
    src: "https://images.unsplash.com/photo-1574758324765-a29c77fb9c91?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHxoYXBweSUyMGNoaWxkcmVuJTIwc3R1ZHlpbmd8ZW58MXx8fHwxNzY5MDkxMzEzfDA&ixlib=rb-4.1.0&q=80&w=1080&utm_source=figma&utm_medium=referral",
    alt: "학생들의 행복한 모습",
    title: "행복한 학습 환경",
  },
];

export function Gallery() {
  return (
    <section id="gallery" className="scroll-mt-24 bg-white py-20">
      <div className="container mx-auto px-4">
        <div className="mb-16 text-center">
          <h2 className="mb-4 text-4xl font-bold md:text-5xl">
            원더랜드 갤러리
          </h2>
          <p className="text-xl text-gray-600">
            아이들의 즐거운 학습 현장을 만나보세요
          </p>
        </div>

        <div className="mb-12 grid gap-4 md:grid-cols-2">
          {images.map((image) => (
            <div
              key={image.title}
              className="group relative overflow-hidden rounded-lg border border-gray-200"
            >
              <ImageWithFallback
                src={image.src}
                alt={image.alt}
                className="h-80 w-full object-cover transition-transform duration-300 group-hover:scale-105"
              />
              <div className="absolute inset-0 flex items-end bg-black/40 opacity-0 transition-opacity duration-300 group-hover:opacity-100">
                <div className="w-full p-6">
                  <h3 className="text-xl font-bold text-white">
                    {image.title}
                  </h3>
                </div>
              </div>
            </div>
          ))}
        </div>

        <div className="rounded-lg border border-gray-200 bg-gray-50 p-8 text-center md:p-12">
          <h3 className="mb-4 text-3xl font-bold">
            무료 체험 수업을 경험해보세요!
          </h3>
          <p className="mb-6 text-xl text-gray-600">
            원더랜드의 특별한 영어 교육을 직접 확인하실 수 있습니다
          </p>
          <button
            onClick={() =>
              document
                .getElementById("contact")
                ?.scrollIntoView({ behavior: "smooth", block: "start" })
            }
            className="rounded bg-gray-900 px-10 py-4 text-white transition hover:bg-gray-800"
            type="button"
          >
            체험 수업 신청하기
          </button>
        </div>
      </div>
    </section>
  );
}
