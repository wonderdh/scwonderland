"use client";

import { ImageWithFallback } from "../common/ImageWithFallback";

function ArrowRightIcon() {
  return (
    <svg
      aria-hidden="true"
      className="h-5 w-5"
      viewBox="0 0 24 24"
      fill="none"
    >
      <path
        d="M5 12h14M13 6l6 6-6 6"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function Hero() {
  const scrollToContact = () => {
    const element = document.getElementById("contact");
    if (element) {
      element.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  };

  return (
    <section id="about" className="scroll-mt-24 bg-gray-50 pt-20">
      <div className="container mx-auto px-4 py-20">
        <div className="mx-auto mb-16 max-w-4xl text-center">
          <p className="mb-4 text-sm text-gray-500">Since 1992</p>
          <h1 className="mb-6 text-5xl font-bold md:text-7xl">
            "왜{" "}
            <span className="text-red-500">원</span>
            <span className="text-yellow-500">더</span>
            <span className="text-green-500">랜</span>
            <span className="text-blue-500">드</span>
            <br />
            일까요?"
          </h1>
          <p className="mb-8 text-xl text-gray-600">
            유치원부터 초등학생까지, 아이들의 영어 실력과 자신감을 키워주는
            <br />
            30년 전통의 영어 전문 교육기관입니다
          </p>
          <button
            onClick={scrollToContact}
            className="inline-flex items-center gap-2 rounded bg-gray-900 px-10 py-4 text-white transition hover:bg-gray-800"
            type="button"
          >
            상담 신청하기
            <ArrowRightIcon />
          </button>
        </div>

        <div className="mx-auto max-w-5xl">
          <div className="rounded-lg bg-gray-900 p-8 md:p-12">
            <div className="grid gap-6 md:grid-cols-3">
              <div className="overflow-hidden rounded-lg">
                <ImageWithFallback
                  src="https://images.unsplash.com/photo-1574132190990-cfd62178bb1c?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxjaGlsZHJlbiUyMGxlYXJuaW5nJTIwY2xhc3Nyb29tfGVufDF8fHx8MTc2OTE0MTg0OXww&ixlib=rb-4.1.0&q=80&w=1080&utm_source=figma&utm_medium=referral"
                  alt="즐거운 수업"
                  className="h-64 w-full object-cover"
                />
              </div>
              <div className="overflow-hidden rounded-lg">
                <ImageWithFallback
                  src="https://images.unsplash.com/photo-1549737221-bef65e2604a6?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxraWRzJTIwcmVhZGluZyUyMGJvb2tzfGVufDF8fHx8MTc2OTAzMzUwN3ww&ixlib=rb-4.1.0&q=80&w=1080&utm_source=figma&utm_medium=referral"
                  alt="집중하는 학습"
                  className="h-64 w-full object-cover"
                />
              </div>
              <div className="overflow-hidden rounded-lg">
                <ImageWithFallback
                  src="https://images.unsplash.com/photo-1574758324765-a29c77fb9c91?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxoYXBweSUyMGNoaWxkcmVuJTIwc3R1ZHlpbmd8ZW58MXx8fHwxNzY5MDkxMzEzfDA&ixlib=rb-4.1.0&q=80&w=1080&utm_source=figma&utm_medium=referral"
                  alt="행복한 아이들"
                  className="h-64 w-full object-cover"
                />
              </div>
            </div>
            <div className="mt-6 text-center">
              <p className="text-sm text-white">www.wonderland-english.com</p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
