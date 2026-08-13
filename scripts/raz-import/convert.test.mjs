import test from "node:test";
import assert from "node:assert/strict";
import { levelOrder, lexileNum } from "./convert.mjs";

test("levelOrder: aa=0, A=1, Z=26, Z1=27, Z2=28", () => {
  assert.equal(levelOrder("aa"), 0);
  assert.equal(levelOrder("A"), 1);
  assert.equal(levelOrder("B"), 2);
  assert.equal(levelOrder("Z"), 26);
  assert.equal(levelOrder("Z1"), 27);
  assert.equal(levelOrder("Z2"), 28);
});

test("levelOrder: 알 수 없는 레벨은 throw", () => {
  assert.throws(() => levelOrder("z"));   // 소문자 z 는 별개
  assert.throws(() => levelOrder(""));
});

test("lexileNum: 440L→440, BR70L→-70, 빈값→null", () => {
  assert.equal(lexileNum("440L"), 440);
  assert.equal(lexileNum("BR70L"), -70);
  assert.equal(lexileNum("0L"), 0);
  assert.equal(lexileNum(""), null);
  assert.equal(lexileNum(null), null);
  assert.equal(lexileNum(undefined), null);
  assert.equal(lexileNum("N/A"), null);   // 패턴 불일치는 null
});
