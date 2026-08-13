// 일회성: resourcelist.json → raz_books 적재.
// 실행: node --env-file=.env.local scripts/raz-import/import-books.mjs
import { readFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";
import { levelOrder, lexileNum } from "./convert.mjs";

const SRC = "D:/Projects/raz-kids/resourcelist.json";
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) throw new Error("NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY 필요 (--env-file=.env.local)");

const raw = JSON.parse(readFileSync(SRC, "utf8"));
const list = Array.isArray(raw) ? raw : raw.books ?? raw.resources;
if (!Array.isArray(list)) throw new Error(`배열을 찾지 못함. 최상위 키: ${Object.keys(raw)}`);

// 원본 필드명이 xlsx 컬럼명과 달라 매핑함 (2026-08-13 확인):
// lexile → lx, genre → g1, genre2 → g2, multilevel → ml, id → 문자열이라 Number() 필요
const rows = list.map((r) => ({
  id: Number(r.id),
  title: String(r.title),
  level: String(r.level),
  level_order: levelOrder(String(r.level)),
  grade: r.grade ?? null,
  lexile: r.lx ?? null,
  lexile_num: lexileNum(r.lx),
  genre: r.g1 ?? null,
  genre2: r.g2 ?? null,
  multilevel: Boolean(r.ml),
}));

// 적재 전 sanity check
console.assert(rows.length === 2572, `행 수 불일치: ${rows.length} (예상 2572)`);
const ids = new Set(rows.map((r) => r.id));
console.assert(ids.size === rows.length, `중복 id 존재: ${rows.length - ids.size}건`);
if (rows.length !== 2572 || ids.size !== rows.length) process.exit(1);

const supabase = createClient(url, key);
for (let i = 0; i < rows.length; i += 500) {
  const batch = rows.slice(i, i + 500);
  const { error } = await supabase.from("raz_books").upsert(batch);
  if (error) {
    console.error(`batch ${i}~${i + batch.length} 실패:`, error.message);
    process.exit(1);
  }
  console.log(`${Math.min(i + 500, rows.length)}/${rows.length}`);
}
console.log("완료");
