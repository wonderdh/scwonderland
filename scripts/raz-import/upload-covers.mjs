// scripts/raz-import/upload-covers.mjs
// 일회성: 표지 PNG → WebP q80 변환 → raz-covers 버킷 업로드.
// 실행: node --env-file=.env.local scripts/raz-import/upload-covers.mjs
import { readdirSync } from "node:fs";
import path from "node:path";
import sharp from "sharp";
import { createClient } from "@supabase/supabase-js";

const DIR = "D:/Projects/raz-kids/images";
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) throw new Error("NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY 필요 (--env-file=.env.local)");

const supabase = createClient(url, key);
const files = readdirSync(DIR).filter((f) => f.endsWith(".png"));
console.log(`${files.length}개 변환·업로드 시작`);

const failed = [];
let done = 0;
let cursor = 0;
// ponytail: 단순 워커 풀 8개. 더 빠른 게 필요하면 CONCURRENCY 만 올리면 됨.
async function worker() {
  while (cursor < files.length) {
    const file = files[cursor++];
    try {
      const webp = await sharp(path.join(DIR, file)).webp({ quality: 80 }).toBuffer();
      const id = path.basename(file, ".png");
      const { error } = await supabase.storage
        .from("raz-covers")
        .upload(`covers/${id}.webp`, webp, { contentType: "image/webp", upsert: true });
      if (error) throw new Error(error.message);
    } catch (e) {
      failed.push(`${file}: ${e.message}`);
    }
    done++;
    if (done % 200 === 0) console.log(`${done}/${files.length}`);
  }
}
await Promise.all(Array.from({ length: 8 }, worker));

if (failed.length) {
  console.error(`실패 ${failed.length}건:\n${failed.join("\n")}`);
  process.exit(1); // 재실행하면 upsert 라 성공분은 건너뛰는 효과
}
console.log(`완료: ${done}개`);
