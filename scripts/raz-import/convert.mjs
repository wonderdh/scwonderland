// 레벨 순서: aa=0, A=1..Z=26, Z1=27, Z2=28 (총 29개). 문자 정렬 불가(aa가 Z 뒤로 감).
const LEVELS = ["aa", ..."ABCDEFGHIJKLMNOPQRSTUVWXYZ", "Z1", "Z2"];

export function levelOrder(level) {
  const i = LEVELS.indexOf(level);
  if (i === -1) throw new Error(`알 수 없는 레벨: ${JSON.stringify(level)}`);
  return i;
}

// "440L" → 440, "BR70L" → -70 (BR = Beginning Reader, 0 미만). 패턴 불일치 → null.
export function lexileNum(lexile) {
  if (!lexile) return null;
  const m = /^(BR)?(\d+)L$/.exec(String(lexile).trim());
  if (!m) return null;
  const n = Number(m[2]);
  return m[1] ? -n : n;
}
