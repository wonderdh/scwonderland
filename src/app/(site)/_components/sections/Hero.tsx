"use client";

import Link from "next/link";
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

  return (
    <section id="about" className="scroll-mt-24 bg-gray-50 pt-24">
      <div className="container mx-auto px-4 py-20">
        <div className="mx-auto mb-16 max-w-4xl text-center">
          <p className="mb-4 text-sm text-gray-500">Since 1992</p>
          <h1 className="mb-6 text-5xl font-bold md:text-7xl">
            &ldquo;왜{" "}
            <span style={{ color: "var(--brand-red)" }}>원</span>
            <span style={{ color: "var(--brand-yellow)" }}>더</span>
            <span style={{ color: "var(--brand-green)" }}>랜</span>
            <span style={{ color: "var(--brand-blue)" }}>드</span>
            <br />
            일까요?&rdquo;
          </h1>
          <p className="mb-8 text-xl text-gray-600">
            유아부터 초등학생까지, 아이들의 영어 실력과 자신감을 키워주는
            <br />
            영어 전문 교육기관입니다
          </p>
          <Link
            href="/community/parent-consultation"
            className="inline-flex items-center gap-2 rounded bg-gray-900 px-10 py-4 text-white transition hover:bg-gray-800"
          >
            상담 신청하기
            <ArrowRightIcon />
          </Link>
        </div>

        <div className="mx-auto max-w-5xl">
          <div className="rounded-lg bg-gray-900 p-8 md:p-12">
            <div className="grid gap-6 md:grid-cols-3">
              <div className="overflow-hidden rounded-lg">
                <ImageWithFallback
                  src="/images/landing/hero_study_1.png"
                  alt="영어 학원에서 즐거운 수업"
                  className="h-64 w-full"
                  priority
                />
              </div>
              <div className="overflow-hidden rounded-lg">
                <ImageWithFallback
                  src="/images/landing/hero_study_2.png"
                  alt="집중해서 영어 책 읽는 아이"
                  className="h-64 w-full"
                />
              </div>
              <div className="overflow-hidden rounded-lg">
                <ImageWithFallback
                  src="/images/landing/hero_study_3.png"
                  alt="영어 수업에 참여하며 웃는 아이들"
                  className="h-64 w-full"
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
