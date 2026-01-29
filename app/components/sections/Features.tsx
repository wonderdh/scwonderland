const features = [
  {
    iconLabel: "C",
    title: "소수정예 수업",
    description: "최대 8명의 소규모 클래스로 개별 맞춤 지도",
    color: "bg-red-500",
  },
  {
    iconLabel: "T",
    title: "검증된 강사진",
    description: "영어교육 전문 자격을 갖춘 경력 교사진",
    color: "bg-yellow-500",
  },
  {
    iconLabel: "K",
    title: "체계적 커리큘럼",
    description: "레벨별, 연령별 맞춤형 교육 프로그램",
    color: "bg-green-500",
  },
  {
    iconLabel: "L",
    title: "즐거운 학습",
    description: "게임과 활동으로 재미있게 배우는 영어",
    color: "bg-blue-500",
  },
  {
    iconLabel: "G",
    title: "실력 향상 보장",
    description: "정기적인 레벨테스트와 성취도 평가",
    color: "bg-red-500",
  },
  {
    iconLabel: "F",
    title: "유연한 시간표",
    description: "방과 후 다양한 시간대 수업 가능",
    color: "bg-yellow-500",
  },
];

export function Features() {
  return (
    <section id="features" className="scroll-mt-24 bg-gray-50 py-20">
      <div className="container mx-auto px-4">
        <div className="mb-16 text-center">
          <h2 className="mb-4 text-4xl font-bold md:text-5xl">
            원더랜드의 장점
          </h2>
          <p className="text-xl text-gray-600">
            아이들이 영어를 사랑하게 만드는 특별한 이유
          </p>
        </div>

        <div className="mb-16 grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {features.map((feature) => (
            <div
              key={feature.title}
              className="rounded-lg border border-gray-200 bg-white p-8 transition-all duration-300 hover:shadow-lg"
            >
              <div
                className={`mb-4 flex h-12 w-12 items-center justify-center rounded text-sm font-bold text-white ${feature.color}`}
                aria-hidden="true"
              >
                {feature.iconLabel}
              </div>
              <h3 className="mb-2 text-xl font-bold">{feature.title}</h3>
              <p className="text-sm text-gray-600">{feature.description}</p>
            </div>
          ))}
        </div>

        <div className="rounded-lg border border-gray-200 bg-white p-8 md:p-12">
          <div className="grid gap-8 text-center md:grid-cols-3">
            <div>
              <div className="mb-2 text-5xl font-bold text-gray-900">30+</div>
              <p className="text-gray-600">년 이상의 교육 경험</p>
            </div>
            <div>
              <div className="mb-2 text-5xl font-bold text-gray-900">500+</div>
              <p className="text-gray-600">누적 수강생</p>
            </div>
            <div>
              <div className="mb-2 text-5xl font-bold text-gray-900">95%</div>
              <p className="text-gray-600">학부모 만족도</p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
