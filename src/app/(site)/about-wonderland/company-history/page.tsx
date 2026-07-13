import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "회사연혁 | 원더랜드 영어학원",
  description: "원더랜드 영어학원 회사연혁",
};

type HistoryItem = {
  year: string;
  side: "left" | "right";
  color: "blue" | "orange" | "green";
  events: { month: string; text: string; highlight?: "blue" | "red" }[];
  isOrigin?: boolean; // 1993 오렌지 배경
};

const HISTORY: HistoryItem[] = [
  {
    year: "2022",
    side: "left",
    color: "blue",
    events: [{ month: "09월", text: "Wonderland 온라인 학습 / 진단 도구 개발" }],
  },
  {
    year: "2021",
    side: "right",
    color: "orange",
    events: [{ month: "06월", text: "High Class Words 670 개발" }],
  },
  {
    year: "2020",
    side: "left",
    color: "green",
    events: [{ month: "01월", text: "370 Essential Sentences 개발" }],
  },
  {
    year: "2019",
    side: "right",
    color: "blue",
    events: [{ month: "06월", text: "My First Words  개발" }],
  },
  {
    year: "2018",
    side: "left",
    color: "orange",
    events: [{ month: "01월", text: "Vocabulary Builder 개발" }],
  },
  {
    year: "2017",
    side: "right",
    color: "green",
    events: [
      { month: "03월", text: "Wonderland Classroom English 개발" },
      { month: "09월", text: "Weekly Expressions 개발" },
    ],
  },
  {
    year: "2016",
    side: "left",
    color: "blue",
    events: [
      { month: "06월", text: "히트상품 선정 (세계일보 스포츠월드 주최)" },
      { month: "08월", text: "2016' Writing Contest  개최" },
    ],
  },
  {
    year: "2015",
    side: "right",
    color: "orange",
    events: [{ month: "06월", text: "2015' Writing Contest  개최" }],
  },
  {
    year: "2014",
    side: "left",
    color: "green",
    events: [
      { month: "01월", text: "UCC Contest 개최" },
      { month: "12월", text: "On-Line Homework 사이트 개발" },
    ],
  },
  {
    year: "2013",
    side: "right",
    color: "blue",
    events: [
      { month: "05월", text: "2013' Writing Contest  개최" },
      { month: "10월", text: "대한민국 교육산업 학원주니어교육 부문 대상 수상 (헤럴드경제신문사)" },
      { month: "10월", text: "My First English Class(적응프로그램) 개발" },
      { month: "12월", text: "필리핀 Camp 진행" },
    ],
  },
  {
    year: "2012",
    side: "left",
    color: "orange",
    events: [
      { month: "03월", text: "오후 유치부 (Wonder K) 프로그램 개발" },
      { month: "05월", text: "2012' Writing Contest  개최" },
    ],
  },
  {
    year: "2011",
    side: "right",
    color: "green",
    events: [{ month: "10월", text: "한국교육산업 대상 수상 (한국경제신문사)" }],
  },
  {
    year: "2010",
    side: "left",
    color: "blue",
    events: [
      { month: "03월", text: "특목고 전문 퀘스트아카데미 어학원 개원", highlight: "blue" },
      { month: "05월", text: "Travel To Live English – 미국 L.A Camp 진행", highlight: "blue" },
      { month: "06월", text: "G20  정상회의 기념 Essay Writing Contest 개최" },
      { month: "07월", text: "Jeju Camp 진행" },
      { month: "11월", text: "창의,  사회, 감성 프로젝트 (W-CELT) 유치부 프로그램 개발" },
    ],
  },
  {
    year: "2009",
    side: "right",
    color: "orange",
    events: [
      { month: "03월", text: "특목고 전문 퀘스트아카데미 영어연구소 설립", highlight: "red" },
      { month: "11월", text: "초등 고학년 대상 High Five  프로그램 개발" },
    ],
  },
  {
    year: "2006",
    side: "left",
    color: "green",
    events: [
      {
        month: "10월",
        text: "외국어 말하기 경연 대회 참가 – 전국 원더랜드 원생 본선 진출",
      },
    ],
  },
  {
    year: "2004",
    side: "right",
    color: "blue",
    events: [
      { month: "03월", text: "퍼스트브랜드 대상 수상 (한국소비자 경제신문사)" },
      {
        month: "06월",
        text: "프랜차이즈 대상 (산업자원부장관상) 4년 연속 수상 (2001년~2004년)",
      },
    ],
  },
  {
    year: "2003",
    side: "left",
    color: "orange",
    events: [
      { month: "02월", text: "WESP,  JEPT, Club Act 교재 출시" },
      { month: "12월", text: "초등 전문 프리모스쿨 사업 시작" },
    ],
  },
  {
    year: "2001",
    side: "right",
    color: "green",
    events: [{ month: "03월", text: "외국어교육기관 최초 ISO 9001인증 획득" }],
  },
  {
    year: "1994",
    side: "left",
    color: "blue",
    events: [
      { month: "07월", text: "대치, 압구정 원더랜드 학원 개원" },
      { month: "11월", text: "전국 프랜차이즈 학원 설립 시작" },
    ],
  },
  {
    year: "1993",
    side: "right",
    color: "orange",
    isOrigin: true,
    events: [{ month: "04월", text: "주니어 영어 전문학원 원더랜드 사업 시작" }],
  },
];

const COLOR_MAP = {
  blue: {
    border: "border-[#3a75ff]",
    line: "bg-[#3a75ff]",
    dot: "#3a75ff",
    text: "text-[#3a75ff]",
  },
  orange: {
    border: "border-[#ff7700]",
    line: "bg-[#ff7700]",
    dot: "#ff7700",
    text: "text-[#ff7700]",
  },
  green: {
    border: "border-[#52b978]",
    line: "bg-[#52b978]",
    dot: "#52b978",
    text: "text-[#52b978]",
  },
};

export default function CompanyHistoryPage() {
  return (
    <section className="bg-white py-16 md:py-24">
      <div className="container mx-auto px-4">
        {/* 헤더 */}
        <div className="text-center">
          <p className="text-base font-extrabold tracking-widest text-gray-900 md:text-lg">
            우리가 걸어온 길
          </p>
          <h1 className="relative mt-4 inline-block pb-6 text-2xl font-extrabold tracking-widest text-gray-900 md:text-4xl">
            History
            <span
              className="absolute bottom-0 left-1/2 h-1.5 w-12 -translate-x-1/2 rounded bg-[#52b978]"
              aria-hidden
            />
          </h1>
          <div
            className="mx-auto mt-8 h-16 max-w-md bg-[#52b978]/10 md:h-20"
            aria-hidden
          />
        </div>

        {/* 타임라인: 모바일은 왼쪽 여백으로 세로선·점 확보 */}
        <div className="relative mt-12 overflow-visible pl-10 md:mt-20 md:pl-0">
          {/* 세로선: 모바일 왼쪽(16px), 데스크톱 가운데 */}
          <div
            className="absolute left-4 top-12 h-[calc(100%-4rem)] w-0.5 bg-gray-200 md:left-1/2 md:top-12 md:h-[calc(100%-6rem)] md:-translate-x-1/2"
            aria-hidden
          />

          <ul className="space-y-8 md:space-y-10">
            {HISTORY.map((item, index) => {
              const colors = COLOR_MAP[item.color];
              const isLeft = item.side === "left";
              return (
                <li
                  key={item.year + index}
                  className={`relative flex w-full md:flex-row ${
                    isLeft ? "" : "md:flex-row-reverse"
                  }`}
                >
                  {/* 점: 모바일 세로선(16px) 위, 데스크톱 가운데 */}
                  <span
                    className="absolute left-[-24px] top-1/2 z-10 h-6 w-6 -translate-x-1/2 -translate-y-1/2 rounded-full border-[3px] border-white shadow-md md:left-1/2 md:h-8 md:w-8 md:border-4"
                    style={{ backgroundColor: colors.dot }}
                    aria-hidden
                  />
                  {/* 내부: 반쪽 너비 + 가로선 + 카드 */}
                  <div
                    className={`relative flex w-full items-center pl-4 md:w-1/2 md:pl-0 ${
                      isLeft ? "md:pr-14 md:text-right" : "md:pl-14 md:text-left"
                    }`}
                  >
                    {/* 점 ↔ 카드 잇는 가로선 (데스크톱) */}
                    <span
                      className={`absolute top-1/2 hidden h-0.5 w-14 -translate-y-1/2 md:block ${
                        isLeft ? "right-0" : "left-0"
                      } ${colors.line}`}
                      aria-hidden
                    />
                    {/* 카드 */}
                    <div
                      className={`w-full rounded-xl px-5 py-4 text-left md:max-w-md ${
                        item.isOrigin
                          ? "bg-[#ff7700] text-white"
                          : "bg-gray-100 text-gray-900"
                      } ${isLeft ? "md:ml-auto" : "md:mr-auto"}`}
                    >
                      <dl>
                        <dt className="text-lg font-extrabold md:text-xl">
                          {item.year}
                        </dt>
                        <dd className="mt-2">
                          <ul className="space-y-1">
                            {item.events.map((ev, i) => (
                              <li
                                key={i}
                                className="relative pl-10 text-sm font-medium leading-snug md:text-base"
                              >
                                <em
                                  className={`absolute left-0 ${
                                    item.isOrigin ? "text-white" : "text-gray-500"
                                  }`}
                                >
                                  {ev.month}
                                </em>
                                {item.isOrigin ? (
                                  <em className="not-italic text-white">
                                    {ev.text}
                                  </em>
                                ) : ev.highlight === "blue" ? (
                                  <span className="text-[#3a75ff]">
                                    {ev.text}
                                  </span>
                                ) : ev.highlight === "red" ? (
                                  <span className="text-[#e73357]">
                                    {ev.text}
                                  </span>
                                ) : (
                                  ev.text
                                )}
                              </li>
                            ))}
                          </ul>
                        </dd>
                      </dl>
                    </div>
                  </div>
                  {/* 반대쪽 빈 공간 (데스크톱에서 반쪽 차지) */}
                  <div className="hidden w-1/2 md:block" aria-hidden />
                </li>
              );
            })}
          </ul>
        </div>
      </div>
    </section>
  );
}
