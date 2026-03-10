/**
 * 학생 나이별 색상 팔레트
 *
 * 5세: 핑크 (가장 어린 아이)
 * 6세: 하늘색 (중간)
 * 7세: 에메랄드 (가장 큰 아이)
 * 기타/미설정: 슬레이트 (기본)
 *
 * Tailwind purge-safe: 완전한 클래스명 리터럴만 사용
 */

export type AgeColorSet = {
  bg: string;
  text: string;
  border: string;
};

// 완전한 클래스명 리터럴 (Tailwind purge 대응)
const AGE_5: AgeColorSet = { bg: "bg-pink-100", text: "text-pink-700", border: "border-pink-200" };
const AGE_6: AgeColorSet = { bg: "bg-sky-100", text: "text-sky-700", border: "border-sky-200" };
const AGE_7: AgeColorSet = { bg: "bg-emerald-100", text: "text-emerald-700", border: "border-emerald-200" };
const AGE_DEFAULT: AgeColorSet = { bg: "bg-slate-100", text: "text-slate-600", border: "border-slate-200" };

export function getAgeColor(age: number | null | undefined): AgeColorSet {
  switch (age) {
    case 5: return AGE_5;
    case 6: return AGE_6;
    case 7: return AGE_7;
    default: return AGE_DEFAULT;
  }
}

export function getAgeLabel(age: number | null | undefined): string {
  return age ? `${age}세` : "";
}
