#!/usr/bin/env node
/**
 * Bulk-add Happy e Readers (KA1..KA10, KB1..KB10, KC1..KC10) to cloud Supabase.
 *
 * - Source PNGs: C:\Users\wonde\Downloads\workbooks\{KA,KB,KC}\{KA,KB,KC}{1..10}.png
 * - Converts to WebP (sharp), uploads to textbook-covers bucket
 * - Levels stored as zero-padded (KA01..KA10) for natural sort
 * - Updates existing KC1 row level KC1 → KC01
 * - Idempotent: skips levels already present
 *
 * Run:
 *   node scripts/seed-happy-e-readers.mjs
 *   (loads .env.cloud directly — never touches local supabase)
 */

import dotenv from "dotenv";
import { createClient } from "@supabase/supabase-js";

dotenv.config({ path: ".env.cloud" });

import sharp from "sharp";
import fs from "node:fs/promises";
import path from "node:path";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_ROLE = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SERVICE_ROLE) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
  process.exit(1);
}

// Loud safety: print host so we never silently target the wrong env.
const host = new URL(SUPABASE_URL).host;
const isLocal = host.includes("localhost") || host.includes("127.0.0.1");
console.log(`Supabase target: ${host} ${isLocal ? "(LOCAL)" : "(REMOTE)"}`);

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE, {
  auth: { persistSession: false },
});

const BUCKET = "textbook-covers";
const SERIES_NAME = "Happy e Readers";
const TOTAL_UNITS = 10;
const SOURCE_ROOT = "C:\\Users\\wonde\\Downloads\\workbooks";

/** "KA", 1 → "KA-01" */
function padLevel(prefix, n) {
  return `${prefix}-${String(n).padStart(2, "0")}`;
}

function randId() {
  return `${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
}

async function getSeriesId() {
  const { data, error } = await supabase
    .from("series")
    .select("id, name")
    .ilike("name", SERIES_NAME)
    .maybeSingle();
  if (error) throw error;
  if (!data) throw new Error(`Series not found: ${SERIES_NAME}`);
  return data.id;
}

async function listExistingLevels(seriesId) {
  const { data, error } = await supabase
    .from("homework_books")
    .select("id, level")
    .eq("series_id", seriesId);
  if (error) throw error;
  return data ?? [];
}

async function convertToWebp(pngPath) {
  const buf = await fs.readFile(pngPath);
  return sharp(buf)
    .resize({ width: 1600, withoutEnlargement: true })
    .webp({ quality: 85 })
    .toBuffer();
}

async function uploadCover(webpBuf, levelLabel) {
  const storagePath = `covers/${randId()}.webp`;
  const { error } = await supabase.storage
    .from(BUCKET)
    .upload(storagePath, webpBuf, { contentType: "image/webp", upsert: false });
  if (error) throw new Error(`upload ${levelLabel}: ${error.message}`);
  const { data } = supabase.storage.from(BUCKET).getPublicUrl(storagePath);
  return data.publicUrl;
}

async function insertBook(seriesId, level, coverUrl) {
  const { error } = await supabase.from("homework_books").insert({
    title: SERIES_NAME,
    series: SERIES_NAME,
    series_id: seriesId,
    level,
    total_units: TOTAL_UNITS,
    sort_order: 0,
    is_active: true,
    cover_image_url: coverUrl,
  });
  if (error) throw new Error(`insert ${level}: ${error.message}`);
}

async function migrateLevelsToHyphen(existing) {
  // 옛 컨벤션 `XX#`, `XX##` → 새 컨벤션 `XX-##` 으로 in-place 정규화.
  let count = 0;
  for (const row of existing) {
    if (!row.level) continue;
    const m = row.level.match(/^([A-Z0-9]{2})(\d{1,2})$/);
    if (!m) continue; // 이미 하이픈이거나 패턴 다름 → 손대지 않음
    const next = `${m[1]}-${m[2].padStart(2, "0")}`;
    if (next === row.level) continue;
    const { error } = await supabase
      .from("homework_books")
      .update({ level: next })
      .eq("id", row.id);
    if (error) throw error;
    console.log(`  migrated ${row.level} → ${next}`);
    row.level = next;
    count++;
  }
  return count;
}

async function main() {
  const seriesId = await getSeriesId();
  console.log(`Series id: ${seriesId}`);

  const existingBefore = await listExistingLevels(seriesId);
  console.log(`Existing rows: ${existingBefore.length}`);

  const migrated = await migrateLevelsToHyphen(existingBefore);
  if (migrated) console.log(`Migrated ${migrated} legacy level(s).`);
  const existingSet = new Set(existingBefore.map((r) => r.level));

  const prefixes = ["KA", "KB", "KC", "1A", "1B", "1C", "2A", "2B", "2C"];
  let added = 0;
  let skipped = 0;

  for (const prefix of prefixes) {
    for (let n = 1; n <= 10; n++) {
      const level = padLevel(prefix, n);
      if (existingSet.has(level)) {
        console.log(`  skip ${level} (exists)`);
        skipped++;
        continue;
      }
      const pngPath = path.join(SOURCE_ROOT, prefix, `${prefix}${n}.png`);
      try {
        await fs.access(pngPath);
      } catch {
        console.warn(`  MISSING source: ${pngPath}`);
        continue;
      }
      const webp = await convertToWebp(pngPath);
      const url = await uploadCover(webp, level);
      await insertBook(seriesId, level, url);
      console.log(`  + ${level} → ${url.split("/").pop()}`);
      added++;
    }
  }

  console.log(`\nDone. added=${added} skipped=${skipped}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
