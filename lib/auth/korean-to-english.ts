/**
 * 한타 → 영타 변환 (두벌식 키보드 매핑)
 *
 * 한글 입력을 영문 키보드 자판 배열 기준으로 변환합니다.
 * 예: "홍길동" → "rlawndks", "홍길동" → "ghdrlfehd"
 */

// 초성 (19): ㄱㄲㄴㄷㄸㄹㅁㅂㅃㅅㅆㅇㅈㅉㅊㅋㅌㅍㅎ
const INITIAL_MAP = [
  "r", "R", "s", "e", "E", "f", "a", "q", "Q", "t",
  "T", "d", "w", "W", "c", "z", "x", "v", "g",
];

// 중성 (21): ㅏㅐㅑㅒㅓㅔㅕㅖㅗㅘㅙㅚㅛㅜㅝㅞㅟㅠㅡㅢㅣ
const MEDIAL_MAP = [
  "k", "o", "i", "O", "j", "p", "u", "P", "h", "hk",
  "ho", "hl", "y", "n", "nj", "np", "nl", "b", "m", "ml",
  "l",
];

// 종성 (28): (없음)ㄱㄲㄳㄴㄵㄶㄷㄹㄺㄻㄼㄽㄾㄿㅀㅁㅂㅄㅅㅆㅇㅈㅊㅋㅌㅍㅎ
const FINAL_MAP = [
  "", "r", "rr", "rt", "s", "sw", "sg", "e", "f", "fr",
  "fa", "fq", "ft", "fx", "fv", "fg", "a", "q", "qt", "t",
  "tt", "d", "w", "c", "z", "x", "v", "g",
];

// 호환용 자모 (U+3131~U+3163) → 개별 자모가 단독으로 올 때
const COMPAT_JAMO_MAP: Record<number, string> = {
  0x3131: "r",  0x3132: "R",  0x3133: "rt", 0x3134: "s",  0x3135: "sw",
  0x3136: "sg", 0x3137: "e",  0x3138: "E",  0x3139: "f",  0x313A: "fr",
  0x313B: "fa", 0x313C: "fq", 0x313D: "ft", 0x313E: "fx", 0x313F: "fv",
  0x3140: "fg", 0x3141: "a",  0x3142: "q",  0x3143: "Q",  0x3144: "qt",
  0x3145: "t",  0x3146: "T",  0x3147: "d",  0x3148: "w",  0x3149: "W",
  0x314A: "c",  0x314B: "z",  0x314C: "x",  0x314D: "v",  0x314E: "g",
  // 모음
  0x314F: "k",  0x3150: "o",  0x3151: "i",  0x3152: "O",  0x3153: "j",
  0x3154: "p",  0x3155: "u",  0x3156: "P",  0x3157: "h",  0x3158: "hk",
  0x3159: "ho", 0x315A: "hl", 0x315B: "y",  0x315C: "n",  0x315D: "nj",
  0x315E: "np", 0x315F: "nl", 0x3160: "b",  0x3161: "m",  0x3162: "ml",
  0x3163: "l",
};

/** 한글 음절 블록인지 (가~힣) */
function isSyllable(code: number): boolean {
  return code >= 0xAC00 && code <= 0xD7A3;
}

/** 호환용 자모인지 (ㄱ~ㅣ) */
function isCompatJamo(code: number): boolean {
  return code >= 0x3131 && code <= 0x3163;
}

/** 문자열에 한글이 포함되어 있는지 */
export function containsKorean(str: string): boolean {
  for (let i = 0; i < str.length; i++) {
    const code = str.charCodeAt(i);
    if (isSyllable(code) || isCompatJamo(code)) return true;
  }
  return false;
}

/** 한글 문자열을 영문 키보드 매핑으로 변환 */
export function koreanToEnglish(str: string): string {
  let result = "";

  for (let i = 0; i < str.length; i++) {
    const code = str.charCodeAt(i);

    if (isSyllable(code)) {
      // 음절 분해: 초성 + 중성 + (종성)
      const offset = code - 0xAC00;
      const initial = Math.floor(offset / (21 * 28));
      const medial = Math.floor((offset % (21 * 28)) / 28);
      const final_ = offset % 28;

      result += INITIAL_MAP[initial];
      result += MEDIAL_MAP[medial];
      if (final_ > 0) result += FINAL_MAP[final_];
    } else if (isCompatJamo(code)) {
      result += COMPAT_JAMO_MAP[code] ?? str[i];
    } else {
      // 영문, 숫자, 특수문자 등 그대로 통과
      result += str[i];
    }
  }

  return result;
}
