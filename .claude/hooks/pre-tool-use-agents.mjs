#!/usr/bin/env node
// PreToolUse hook — Edit/Write/MultiEdit 대상 file_path 의 상위 폴더 트리에서
// AGENTS.md 를 모아 additionalContext 로 주입한다.
//
// fail-loud / fail-closed:
//   훅 내부 오류 (stdin 깨짐, AGENTS.md 읽기 실패 등) 는 exit 2 + stderr 로
//   도구를 차단해서 사용자가 알게 한다.
//   silent skip 은 "AGENTS.md 가 없는 게 정상" 인 케이스로만 한정 — project
//   외부 경로, 매칭 0개, 매처 밖 도구, file_path 없는 도구.
//
// 환경변수:
//   CLAUDE_PROJECT_DIR — 프로젝트 루트. 미설정 시 cwd.
//   AGENTS_HOOK_DEBUG=1 — walk 결과 등 디버그를 stderr 에 dump.
//
// requires Node.js 18+

import {
  readFileSync,
  existsSync,
  appendFileSync,
  mkdirSync,
  realpathSync,
  statSync,
} from "node:fs";
import { join, resolve, dirname, relative, isAbsolute } from "node:path";

const SCRIPT = "[agents-hook]";
const FILE_CAP = 100 * 1024;
const TOTAL_CAP = 200 * 1024;
const DEBUG = process.env.AGENTS_HOOK_DEBUG === "1";

let LOG_PATH = null;

function tryLog(line) {
  if (!LOG_PATH) return;
  try {
    mkdirSync(dirname(LOG_PATH), { recursive: true });
    appendFileSync(LOG_PATH, `${new Date().toISOString()} ${line}\n`);
  } catch (e) {
    process.stderr.write(`${SCRIPT} WARN: log write failed: ${e.message}\n`);
  }
}

function fatal(code, msg, extra) {
  process.stderr.write(`${SCRIPT} FATAL: ${msg}\n`);
  if (extra && DEBUG) process.stderr.write(`${SCRIPT} debug: ${extra}\n`);
  tryLog(`FATAL ${code}`);
  process.exit(2);
}

function warn(msg) {
  process.stderr.write(`${SCRIPT} WARN: ${msg}\n`);
}

function debug(msg) {
  if (DEBUG) process.stderr.write(`${SCRIPT} debug: ${msg}\n`);
}

function normalize(p) {
  // realpath 가 Windows 드라이브 letter casing 도 정규화 + symlink 풀어줌.
  // 존재 안 하는 경로면 throw → resolve 로 fallback.
  try {
    return realpathSync(p);
  } catch {
    return resolve(p);
  }
}

function isInsideOrEqual(child, parent) {
  if (child === parent) return true;
  const rel = relative(parent, child);
  return rel !== "" && !rel.startsWith("..") && !isAbsolute(rel);
}

// fail-loud: uncaught 도 차단으로 처리
process.on("uncaughtException", (e) => {
  process.stderr.write(`${SCRIPT} FATAL: uncaught exception: ${e.message}\n`);
  if (DEBUG && e.stack) process.stderr.write(`${SCRIPT} debug: ${e.stack}\n`);
  process.exit(2);
});
process.on("unhandledRejection", (e) => {
  const msg = e?.message ?? String(e);
  process.stderr.write(`${SCRIPT} FATAL: unhandled rejection: ${msg}\n`);
  process.exit(2);
});

// ---------- root 결정 ----------
const rawRoot = process.env.CLAUDE_PROJECT_DIR ?? process.cwd();
if (!existsSync(rawRoot)) {
  process.stderr.write(`${SCRIPT} FATAL: CLAUDE_PROJECT_DIR=${rawRoot} does not exist\n`);
  process.exit(2);
}
const root = normalize(rawRoot);
LOG_PATH = join(root, ".claude", "hooks", "pre-tool-use.log");

// ---------- stdin 파싱 ----------
let raw;
try {
  raw = readFileSync(0, "utf8");
} catch (e) {
  fatal("stdin-read", `stdin read failed: ${e.message}`);
}
let payload;
try {
  payload = JSON.parse(raw);
} catch (e) {
  fatal("stdin-parse", `stdin parse failed: ${e.message}`, `raw=${raw.slice(0, 200)}`);
}

const tool = payload?.tool_name;
const filePath = payload?.tool_input?.file_path;

const HANDLED = new Set(["Edit", "Write", "MultiEdit"]);
if (!HANDLED.has(tool)) {
  debug(`skip: tool=${tool} not in matcher`);
  tryLog(`SKIP non-edit tool=${tool}`);
  process.exit(0);
}

if (typeof filePath !== "string" || filePath.length === 0) {
  fatal("missing-file_path", `tool_input.file_path missing for ${tool}`);
}

// ---------- file_path 정규화 ----------
const absFile = isAbsolute(filePath) ? filePath : resolve(root, filePath);
const startDir = normalize(dirname(absFile));
const relFile = relative(root, absFile).replaceAll("\\", "/");

if (!isInsideOrEqual(startDir, root)) {
  debug(`skip outside-root: file=${absFile} startDir=${startDir} root=${root}`);
  tryLog(`SKIP outside-root tool=${tool} file=${absFile}`);
  process.exit(0);
}

// ---------- walk-up ----------
const found = [];
let dir = startDir;
let safety = 64;
while (safety-- > 0) {
  const candidate = join(dir, "AGENTS.md");
  if (existsSync(candidate)) {
    let st;
    try {
      st = statSync(candidate);
    } catch (e) {
      fatal("stat-fail", `cannot stat ${candidate}: ${e.message}`);
    }
    if (st.isFile()) found.push(candidate);
  }
  if (dir === root) break;
  const parent = dirname(dir);
  if (parent === dir) break;
  if (!isInsideOrEqual(parent, root)) break;
  dir = parent;
}

found.reverse(); // root 가까운 것 먼저
debug(`walk found=${found.length} startDir=${startDir} root=${root}`);

// ---------- 본문 수집 + size cap ----------
let totalBytes = 0;
const sections = [];
let skippedByTotalCap = 0;
for (const p of found) {
  if (totalBytes >= TOTAL_CAP) {
    skippedByTotalCap += 1;
    continue;
  }
  let body;
  try {
    body = readFileSync(p, "utf8");
  } catch (e) {
    fatal("read-fail", `cannot read ${p}: ${e.message}`);
  }
  const original = Buffer.byteLength(body, "utf8");
  let truncatedNote = "";
  if (original > FILE_CAP) {
    body = body.slice(0, FILE_CAP);
    truncatedNote = `\n\n…(truncated from ${original}B to ${FILE_CAP}B)`;
    warn(`${p} truncated from ${original}B to ${FILE_CAP}B`);
    tryLog(`WARN truncate path=${relative(root, p).replaceAll("\\", "/")} from=${original}`);
  }
  const header = `# AGENTS.md (${relative(root, p).replaceAll("\\", "/")})`;
  const section = `${header}\n\n${body}${truncatedNote}`;
  totalBytes += Buffer.byteLength(section, "utf8");
  sections.push(section);
}
if (skippedByTotalCap > 0) {
  warn(`total cap ${TOTAL_CAP}B reached, skipped ${skippedByTotalCap} remaining AGENTS.md`);
  tryLog(`WARN total-cap skipped=${skippedByTotalCap}`);
}

// ---------- 출력 ----------
if (sections.length === 0) {
  tryLog(`SKIP no-match tool=${tool} file=${relFile}`);
  process.exit(0);
}

let out;
try {
  out = JSON.stringify({
    hookSpecificOutput: {
      hookEventName: "PreToolUse",
      additionalContext: sections.join("\n\n---\n\n"),
    },
  });
} catch (e) {
  fatal("serialize", `stdout serialize failed: ${e.message}`);
}

tryLog(`OK tool=${tool} matched=${sections.length} bytes=${totalBytes} file=${relFile}`);
process.stdout.write(out);
