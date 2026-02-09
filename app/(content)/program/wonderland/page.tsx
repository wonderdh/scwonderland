import type { Metadata } from "next";
import styles from "./CurriculumProgram.module.css";

export const metadata: Metadata = {
  title: "Wonderland | 원더랜드 영어학원",
  description: "원더랜드 영어학원 Wonderland 프로그램",
};

const yearGoals = [
  {
    year: "3rd Year",
    icon: "/images/program/wonderland/wonderland_icon1.svg",
    items: [
      "1,300단어 이상의 어휘 실력을 갖추고 읽기에 전혀 무리가 없습니다.",
      "문장 위주의 세련된 영어 표현이 가능합니다.",
      "사고력이 확장되어 쓰기를 통한 Presentation을 할 수 있습니다.",
    ],
  },
  {
    year: "2nd Year",
    icon: "/images/program/wonderland/wonderland_icon2.svg",
    items: [
      "1,000단어 이상의 어휘 실력을 갖추고 읽기에 자신감이 생깁니다.",
      "단어 위주의 영어 구사 비율이 줄고 문장으로 구사할 수 있으며, 자신의 생각을 담은 간단한 쓰기가 가능합니다.",
    ],
  },
  {
    year: "1st Year",
    icon: "/images/program/wonderland/wonderland_icon3.svg",
    items: [
      "700단어 이상의 어휘 실력을 갖추고 Phonics에 대한 이해 체계를 형성합니다.",
      "반복되는 표현들에 대해 자신 있게 구사하며 상황에 맞게 단어를 사용해 자신의 생각을 표현해 말할 수 있습니다.",
      "주어진 주제에 관련된 단문 위주의 쓰기가 가능합니다.",
    ],
  },
];

/* commonui.css .program .prbox 순서: pr1~pr5 카드, pr6 중앙 로고 */
const programs = [
  { title: "표현생활", content: "Art & Craft, Sing & Chant, Activities, Story Telling, Presentation", pr: "pr1" as const },
  { title: "자연탐구생활", content: "Math,\nScience,\nField Trip", pr: "pr2" as const },
  { title: "사회생활", content: "International Day,\nSituation English,\nRole Play", pr: "pr3" as const },
  { title: "신체, 건강생활", content: "Gym Class, Role Play,\nField Trip,\nActivities,\nGames", pr: "pr4" as const },
  { title: "언어생활", content: "Classroom & Daily English,\nWeekly Expressions,\nPhonics, Course Book,\nSituation English,\nWriting Book", pr: "pr5" as const },
];

export default function ProgramWonderlandPage() {
  return (
    <>
      {/* 상단: 오전 유치부 소개 + 이미지 */}
      <section className="bg-white py-16 md:py-24">
        <div className="container mx-auto px-4">
          <div className="mx-auto max-w-6xl">
            <div className="flex flex-col gap-10 md:flex-row md:items-center md:gap-12">
              <div className="shrink-0 md:w-[320px] md:max-w-[40%]">
                <p className="text-base font-medium text-gray-600 md:text-lg">
                  <strong className="font-bold text-gray-900">오전</strong> 유치부
                  프로그램 / 5세 ~ 7세 대상
                </p>
                <h2 className="mt-4 text-3xl font-extrabold text-gray-900 md:text-4xl">
                  Wonderland
                </h2>
                <p className="mt-6 whitespace-pre-line text-lg leading-relaxed text-gray-700">
                  다양한 테마와 과목들을 접하여
                  {"\n"}
                  입과 귀가 열리고, 영어의 감각을
                  {"\n"}
                  키워가는 단계입니다.
                </p>
              </div>
              <div className="min-w-0 flex-1">
                <div className="overflow-hidden rounded-xl bg-gray-100">
                  <img
                    src="/images/program/wonderland/wonderland_img.png"
                    alt="Wonderland 프로그램"
                    className="h-auto w-full object-contain"
                  />
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* 연차별 학습 목표 */}
      <section className="bg-gray-50 py-16 md:py-24">
        <div className="container mx-auto px-4">
          <div className="mx-auto max-w-4xl">
            <h2 className="mb-12 text-2xl font-bold text-gray-900 md:text-3xl">
              연차별 학습 목표
            </h2>
            <div className="space-y-10 md:space-y-12">
              {yearGoals.map((block) => (
                <div
                  key={block.year}
                  className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm md:p-8"
                >
                  <p className="mb-4 flex items-center gap-3 text-lg font-bold text-gray-900">
                    <span className="flex h-10 w-10 shrink-0 items-center justify-center">
                      <img
                        src={block.icon}
                        alt=""
                        className="h-8 w-8 object-contain"
                      />
                    </span>
                    {block.year}
                  </p>
                  <ul className="list-inside list-disc space-y-2 text-gray-700">
                    {block.items.map((item, i) => (
                      <li key={i}>{item}</li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* 교육 과정 연계 프로그램 - 원형 레이아웃 */}
      <section className="bg-white py-16 md:py-24">
        <div className="container mx-auto px-4">
          <div className="mx-auto max-w-6xl">
            <h2 className="mb-10 text-2xl font-bold text-gray-900 md:mb-12 md:text-3xl">
              교육 과정 연계 프로그램
            </h2>
            <div className={styles.wrapper}>
              {programs.map((pr) => (
                <div key={pr.title} className={`${styles.node} ${styles[pr.pr]}`}>
                  <strong className={styles.nodeTitle}>{pr.title}</strong>
                  <span className={styles.nodeContent}>{pr.content}</span>
                </div>
              ))}
              <div className={`${styles.node} ${styles.center}`}>
                <span className={styles.centerLogoWrap}>
                  <img src="/images/common/logo-b.svg" alt="원더랜드" />
                </span>
              </div>
            </div>
          </div>
        </div>
      </section>
    </>
  );
}
