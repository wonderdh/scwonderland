"use client";

import { useState } from "react";

export function Contact() {
  const [formData, setFormData] = useState({
    name: "",
    phone: "",
    age: "",
    message: "",
  });

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    alert("상담 신청이 접수되었습니다! 빠른 시일 내에 연락드리겠습니다.");
    setFormData({ name: "", phone: "", age: "", message: "" });
  };

  const handleChange = (
    event: React.ChangeEvent<
      HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement
    >
  ) => {
    setFormData((prev) => ({
      ...prev,
      [event.target.name]: event.target.value,
    }));
  };

  return (
    <section id="contact" className="scroll-mt-24 bg-gray-50 py-20">
      <div className="container mx-auto px-4">
        <div className="mb-16 text-center">
          <h2 className="mb-4 text-4xl font-bold md:text-5xl">상담 문의</h2>
          <p className="text-xl text-gray-600">
            아이의 영어 교육, 원더랜드와 함께 시작하세요
          </p>
        </div>

        <div className="grid gap-8 md:grid-cols-2">
          <div className="space-y-6">
            <div className="rounded-lg border border-gray-200 bg-white p-6">
              <h3 className="mb-6 text-xl font-bold">연락처 정보</h3>
              <div className="space-y-6">
                <div className="flex items-start space-x-4">
                  <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded bg-gray-100">
                    <span className="text-sm font-semibold text-gray-700">
                      MAP
                    </span>
                  </div>
                  <div>
                    <h4 className="mb-1 text-sm font-bold">주소</h4>
                    <p className="text-sm text-gray-600">
                      서울시 강남구 테헤란로 123
                      <br />
                      원더랜드 빌딩 2-3층
                    </p>
                  </div>
                </div>

                <div className="flex items-start space-x-4">
                  <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded bg-gray-100">
                    <span className="text-sm font-semibold text-gray-700">
                      TEL
                    </span>
                  </div>
                  <div>
                    <h4 className="mb-1 text-sm font-bold">전화번호</h4>
                    <p className="text-sm text-gray-600">02-1234-5678</p>
                  </div>
                </div>

                <div className="flex items-start space-x-4">
                  <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded bg-gray-100">
                    <span className="text-sm font-semibold text-gray-700">
                      MAIL
                    </span>
                  </div>
                  <div>
                    <h4 className="mb-1 text-sm font-bold">이메일</h4>
                    <p className="text-sm text-gray-600">
                      info@wonderland-english.kr
                    </p>
                  </div>
                </div>

                <div className="flex items-start space-x-4">
                  <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded bg-gray-100">
                    <span className="text-sm font-semibold text-gray-700">
                      TIME
                    </span>
                  </div>
                  <div>
                    <h4 className="mb-1 text-sm font-bold">운영 시간</h4>
                    <p className="text-sm text-gray-600">
                      평일: 오후 1시 - 9시
                      <br />
                      토요일: 오전 9시 - 오후 6시
                      <br />
                      일요일: 휴무
                    </p>
                  </div>
                </div>
              </div>
            </div>

            <div className="rounded-lg bg-gray-900 p-6 text-white">
              <h3 className="mb-4 text-xl font-bold">오시는 길</h3>
              <ul className="space-y-2 text-sm">
                <li>• 지하철 2호선 강남역 3번 출구 도보 5분</li>
                <li>• 지하철 분당선 선릉역 6번 출구 도보 7분</li>
                <li>• 주차 가능 (건물 지하 주차장 이용)</li>
              </ul>
            </div>
          </div>

          <div className="rounded-lg border border-gray-200 bg-white p-6 md:p-8">
            <h3 className="mb-6 text-xl font-bold">상담 신청하기</h3>
            <form onSubmit={handleSubmit} className="space-y-5">
              <div>
                <label
                  htmlFor="name"
                  className="mb-2 block text-sm font-medium text-gray-700"
                >
                  학부모 성함 *
                </label>
                <input
                  type="text"
                  id="name"
                  name="name"
                  value={formData.name}
                  onChange={handleChange}
                  required
                  className="w-full rounded border border-gray-300 px-4 py-3 outline-none transition focus:border-transparent focus:ring-2 focus:ring-gray-900"
                  placeholder="홍길동"
                />
              </div>

              <div>
                <label
                  htmlFor="phone"
                  className="mb-2 block text-sm font-medium text-gray-700"
                >
                  연락처 *
                </label>
                <input
                  type="tel"
                  id="phone"
                  name="phone"
                  value={formData.phone}
                  onChange={handleChange}
                  required
                  className="w-full rounded border border-gray-300 px-4 py-3 outline-none transition focus:border-transparent focus:ring-2 focus:ring-gray-900"
                  placeholder="010-1234-5678"
                />
              </div>

              <div>
                <label
                  htmlFor="age"
                  className="mb-2 block text-sm font-medium text-gray-700"
                >
                  자녀 연령대 *
                </label>
                <select
                  id="age"
                  name="age"
                  value={formData.age}
                  onChange={handleChange}
                  required
                  className="w-full rounded border border-gray-300 px-4 py-3 outline-none transition focus:border-transparent focus:ring-2 focus:ring-gray-900"
                >
                  <option value="">선택해주세요</option>
                  <option value="5-7">유치부 (5-7세)</option>
                  <option value="8-10">초등 저학년 (8-10세)</option>
                  <option value="11-13">초등 고학년 (11-13세)</option>
                </select>
              </div>

              <div>
                <label
                  htmlFor="message"
                  className="mb-2 block text-sm font-medium text-gray-700"
                >
                  문의 내용
                </label>
                <textarea
                  id="message"
                  name="message"
                  value={formData.message}
                  onChange={handleChange}
                  rows={4}
                  className="w-full resize-none rounded border border-gray-300 px-4 py-3 outline-none transition focus:border-transparent focus:ring-2 focus:ring-gray-900"
                  placeholder="궁금하신 내용을 자유롭게 적어주세요"
                />
              </div>

              <button
                type="submit"
                className="w-full rounded bg-gray-900 py-3 font-medium text-white transition hover:bg-gray-800"
              >
                상담 신청하기
              </button>

              <p className="text-center text-sm text-gray-500">
                신청해주시면 영업일 기준 1-2일 내로 연락드립니다
              </p>
            </form>
          </div>
        </div>
      </div>
    </section>
  );
}
