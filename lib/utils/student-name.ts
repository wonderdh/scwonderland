/**
 * 학생 이름 포맷 유틸.
 * korean_name / english_name 조합을 컨텍스트에 맞게 표시.
 *
 * - `preferEnglish`: true면 영문명 우선 (원어민 교사 포털 등)
 * - `fallback`: 둘 다 비었을 때 표시할 문자열 (기본 "이름 없음").
 *   정렬 비교 등 빈 문자열이 필요한 곳에서는 `""`를 명시.
 */
export function formatStudentName(
  student: {
    korean_name?: string | null;
    english_name?: string | null;
  },
  options?: { preferEnglish?: boolean; fallback?: string },
): string {
  const fallback = options?.fallback ?? "이름 없음";
  if (options?.preferEnglish) {
    return student.english_name || student.korean_name || fallback;
  }
  return student.korean_name || student.english_name || fallback;
}
