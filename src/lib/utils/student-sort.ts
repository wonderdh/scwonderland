/**
 * 학생 정렬 공통 유틸 (나이순 → 한글 이름순)
 */
export function sortStudentsByAgeAndName<
  T extends { age?: number | null; korean_name?: string | null; first_name?: string | null },
>(students: T[], ageFirst = true): T[] {
  return [...students].sort((a, b) => {
    if (ageFirst) {
      const ageDiff = (a.age ?? 99) - (b.age ?? 99);
      if (ageDiff !== 0) return ageDiff;
    }
    return (a.korean_name ?? a.first_name ?? "").localeCompare(
      b.korean_name ?? b.first_name ?? "",
      "ko",
    );
  });
}
