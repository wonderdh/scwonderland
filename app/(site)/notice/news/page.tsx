import type { Metadata } from "next";
import { PageContent } from "@/app/(site)/_components/sections/PageContent";

export const metadata: Metadata = {
  title: "News | 원더랜드 영어학원",
  description: "원더랜드 영어학원 News",
};

const FAKE_NEWS = [
  {
    id: 1,
    title: "2025년 봄학기 정규반 모집 안내",
    date: "2025-02-10",
    excerpt:
      "원더랜드 영어학원 2025년 봄학기 정규반 수강생을 모집합니다. 초등·중등 맞춤 프로그램으로 2월 말 개강 예정입니다.",
  },
  {
    id: 2,
    title: "TOEFL Junior 정기 시험 일정 공지",
    date: "2025-02-05",
    excerpt:
      "3월 TOEFL Junior 정기 시험 접수가 시작되었습니다. 학원 내 집단 접수 가능하며, 자세한 일정은 학원으로 문의해 주세요.",
  },
  {
    id: 3,
    title: "원더랜드 겨울 특강 수강생 모집 (선착순)",
    date: "2025-01-28",
    excerpt:
      "겨울 방학 특강 프로그램이 마련되었습니다. 독해·청취 집중 코스와 말하기·쓰기 워크숍을 운영합니다.",
  },
  {
    id: 4,
    title: "학원 휴원일 안내 (설 연휴)",
    date: "2025-01-20",
    excerpt:
      "설 연휴 기간 학원 휴원일을 안내드립니다. 1월 28일(화) ~ 1월 31일(금) 휴원이며, 2월 3일(월)부터 정상 운영합니다.",
  },
  {
    id: 5,
    title: "2024 겨울 학력평가 결과 및 상담 안내",
    date: "2025-01-15",
    excerpt:
      "겨울 학력평가 결과가 반영되었습니다. 개별 상담 희망 시 학원으로 연락 주시면 일정 조율해 드리겠습니다.",
  },
];

export default function NewsPage() {
  return (
    <PageContent title="News">
      <ul className="divide-y divide-gray-200">
        {FAKE_NEWS.map((item) => (
          <li key={item.id} className="py-6 first:pt-0">
            <article>
              <time
                dateTime={item.date}
                className="text-sm font-medium text-gray-500"
              >
                {item.date}
              </time>
              <h2 className="mt-1 text-xl font-semibold text-gray-900">
                {item.title}
              </h2>
              <p className="mt-2 text-gray-600">{item.excerpt}</p>
            </article>
          </li>
        ))}
      </ul>
    </PageContent>
  );
}
