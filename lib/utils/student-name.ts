/**
 * 학생 이름 포맷 유틸.
 * korean_name / english_name 조합을 컨텍스트에 맞게 표시.
 */
export function formatStudentName(
  student: {
    korean_name: string | null;
    english_name: string | null;
  },
  options?: { preferEnglish?: boolean },
): string {
  if (options?.preferEnglish) {
    return (
      student.english_name || student.korean_name || "이름 없음"
    );
  }
  return student.korean_name || student.english_name || "이름 없음";
}
