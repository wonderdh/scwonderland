const programs = [
  {
    iconLabel: "K",
    title: "유치부 프로그램",
    age: "5-7세",
    description: "놀이와 노래를 통해 자연스럽게 영어를 접하는 프로그램",
    color: "text-red-500",
    bgColor: "bg-red-50",
    features: ["파닉스 기초", "영어 동화", "노래와 율동", "미술 활동"],
  },
  {
    iconLabel: "L",
    title: "초등 저학년",
    age: "8-10세",
    description: "읽기와 쓰기 능력을 키우며 영어 기초를 탄탄하게",
    color: "text-yellow-500",
    bgColor: "bg-yellow-50",
    features: ["리딩 집중", "기초 문법", "스피킹 연습", "어휘 확장"],
  },
  {
    iconLabel: "U",
    title: "초등 고학년",
    age: "11-13세",
    description: "실전 영어 능력 향상과 자신감 있는 의사소통",
    color: "text-green-500",
    bgColor: "bg-green-50",
    features: ["토론 수업", "작문 연습", "발표 능력", "영어 시험 대비"],
  },
  {
    iconLabel: "S",
    title: "특별 프로그램",
    age: "전 연령",
    description: "원어민 수업, 캠프, 영어 뮤지컬 등 다양한 특별 활동",
    color: "text-blue-500",
    bgColor: "bg-blue-50",
    features: ["원어민 회화", "영어 캠프", "뮤지컬", "독서 클럽"],
  },
];

export function Programs() {
  return (
    <section id="programs" className="scroll-mt-24 bg-white py-20">
      <div className="container mx-auto px-4">
        <div className="mb-16 text-center">
          <h2 className="mb-4 text-4xl font-bold md:text-5xl">
            프로그램 소개
          </h2>
          <p className="text-xl text-gray-600">
            연령별 맞춤 커리큘럼으로 최적의 학습 효과를 제공합니다
          </p>
        </div>

        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
          {programs.map((program) => (
            <div
              key={program.title}
              className={`${program.bgColor} rounded-lg p-6 transition-all duration-300 hover:shadow-lg`}
            >
              <div
                className={`mb-4 flex h-10 w-10 items-center justify-center rounded-full bg-white/70 text-sm font-bold ${program.color}`}
                aria-hidden="true"
              >
                {program.iconLabel}
              </div>
              <h3 className="mb-2 text-xl font-bold">{program.title}</h3>
              <span className="mb-3 inline-block rounded-full bg-white px-3 py-1 text-sm text-gray-700">
                {program.age}
              </span>
              <p className="mb-4 text-sm text-gray-700">{program.description}</p>
              <ul className="space-y-2">
                {program.features.map((feature) => (
                  <li key={feature} className="flex items-center text-sm text-gray-600">
                    <span
                      className={`mr-2 h-1.5 w-1.5 rounded-full ${program.color.replace("text-", "bg-")}`}
                      aria-hidden="true"
                    />
                    {feature}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
