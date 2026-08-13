// src/lib/raz/stats.test.mjs
// 실행: pnpm test (scripts/test-hooks.mjs 가 @/ alias 를 src/ 로 해석)
import test from "node:test";
import assert from "node:assert/strict";
import { aggregateReadingStats } from "@/lib/raz/stats";

const books = [
  { id: 1, level: "aa", level_order: 0 },
  { id: 2, level: "A", level_order: 1 },
  { id: 3, level: "B", level_order: 2 },
];
const classes = [
  {
    id: "c1",
    name: "1반",
    students: [
      { id: "s1", koreanName: "김철수", englishName: "Chul" },
      { id: "s2", koreanName: "이영희", englishName: null },
    ],
  },
];

test("읽은 권수·최고 레벨·레벨별 카운트 집계", () => {
  const logs = [
    { student_id: "s1", book_id: 1 },
    { student_id: "s1", book_id: 2 },
    { student_id: "s1", book_id: 3 },
  ];
  const [c] = aggregateReadingStats(classes, logs, books);
  const s1 = c.students.find((s) => s.studentId === "s1");
  assert.equal(s1.readCount, 3);
  assert.equal(s1.topLevel, "B");
  assert.deepEqual(s1.levelCounts, { aa: 1, A: 1, B: 1 });
});

test("로그 없는 학생은 0권·topLevel null", () => {
  const [c] = aggregateReadingStats(classes, [], books);
  const s2 = c.students.find((s) => s.studentId === "s2");
  assert.equal(s2.readCount, 0);
  assert.equal(s2.topLevel, null);
  assert.deepEqual(s2.levelCounts, {});
});

test("카탈로그에 없는 book_id 는 무시하되 readCount 에는 포함하지 않음", () => {
  const logs = [{ student_id: "s1", book_id: 999 }];
  const [c] = aggregateReadingStats(classes, logs, books);
  const s1 = c.students.find((s) => s.studentId === "s1");
  assert.equal(s1.readCount, 0);
});
