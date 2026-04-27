#!/usr/bin/env node
import { execFileSync, spawnSync } from "node:child_process";
import {
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  renameSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { basename, join, relative, resolve, sep } from "node:path";

const ROOT = process.env.CLAUDE_PROJECT_DIR
  ? resolve(process.env.CLAUDE_PROJECT_DIR)
  : resolve(process.cwd());
const WORKTREE_ROOT = process.env.HARNESS_WORKTREE_ROOT || "C:\\scwonderland-worktrees";
const MANIFEST_PATH = join(ROOT, "HARNESS_MANIFEST.json");
const STRUCTURE_PATH = join(ROOT, "STRUCTURE.md");
const ACTIVE_PLANS_DIR = join(ROOT, ".claude", "plans", "active");
const COMPLETED_PLANS_DIR = join(ROOT, ".claude", "plans", "completed");
const RUNS_DIR = join(ROOT, ".claude", "runs");

const TEST_COMMANDS = new Set([
  "npm run check:auth",
  "npm run lint",
  "npm run type-check",
  "npm run build",
  "npm run harness -- validate",
  "npm run harness -- docs detect",
]);

function main() {
  const [, , ...args] = process.argv;
  const [cmd, sub, ...rest] = args;
  try {
    if (!cmd || cmd === "help") return help();
    if (cmd === "manifest") return writeManifest();
    if (cmd === "structure") return writeStructure();
    if (cmd === "context") return context(rest.join(" "));
    if (cmd === "docs" && sub === "detect") return docsDetect();
    if (cmd === "validate") return validate();
    if (cmd === "finish") return finish(sub);
    if (cmd === "worktree") return worktree(sub, rest);
    if (cmd === "hook") return hook(sub);
    fail(`Unknown command: ${args.join(" ")}`);
  } catch (error) {
    fail(error?.message || String(error));
  }
}

function help() {
  console.log(`SC Wonderland harness

Commands:
  npm run harness -- manifest
  npm run harness -- structure
  npm run harness -- context <prompt-or-path>
  npm run harness -- docs detect
  npm run harness -- validate
  npm run harness -- finish <active-plan.md>
  npm run harness -- worktree start <slug>
  npm run harness -- worktree status
  npm run harness -- worktree cleanup <slug>
  npm run harness -- hook pre-edit|pre-bash|post-edit|stop|subagent-stop
`);
}

function worktree(sub, rest) {
  if (sub === "status") {
    console.log(run("git", ["worktree", "list", "--porcelain"]));
    return;
  }
  if (sub === "start") {
    const slug = rest[0];
    if (!slug) fail("Usage: npm run harness -- worktree start <task-slug>");
    const branch = `claude/${slug}`;
    const target = join(WORKTREE_ROOT, slug);
    if (gitBranch() !== "main") fail("Start worktrees from main only.");
    if (gitDirty()) fail("Main worktree is dirty. Commit/stash before starting a task worktree.");
    mkdirSync(WORKTREE_ROOT, { recursive: true });
    run("git", ["worktree", "add", "-b", branch, target, "main"], { stdio: "inherit" });
    console.log(`Created worktree ${target} on ${branch}`);
    return;
  }
  if (sub === "cleanup") {
    const slug = rest[0];
    if (!slug) fail("Usage: npm run harness -- worktree cleanup <task-slug>");
    const target = join(WORKTREE_ROOT, slug);
    run("git", ["worktree", "remove", target], { stdio: "inherit" });
    return;
  }
  fail("Usage: npm run harness -- worktree start|status|cleanup");
}

function hook(kind) {
  const input = readStdinJson();
  if (kind === "pre-edit") return hookPreEdit(input);
  if (kind === "pre-bash") return hookPreBash(input);
  if (kind === "post-edit") return hookPostEdit(input);
  if (kind === "stop") return hookStop(input);
  if (kind === "subagent-stop") return hookSubagentStop(input);
  fail(`Unknown hook: ${kind}`);
}

function hookPreEdit(input) {
  const filePath = normalizePath(input?.tool_input?.file_path || input?.tool_input?.path || "");
  if (!filePath) return allow();
  if (!isProtectedPath(filePath)) return allow();
  if (gitBranch() === "main") {
    return block(`main branch에서는 코드/설정/script/package 수정이 금지됩니다. 먼저 npm run harness -- worktree start <task-slug> 로 작업 worktree를 만드세요.`);
  }
  const plans = activePlans();
  if (plans.length === 0) {
    return block(`active plan이 없습니다. .claude/plans/active/ 에 plan을 작성한 뒤 수정하세요.`);
  }
  return allow();
}

function hookPreBash(input) {
  const command = String(input?.tool_input?.command || "").trim();
  if (!command) return allow();
  const normalized = command.replace(/\s+/g, " ");
  for (const testCommand of TEST_COMMANDS) {
    if (normalized.startsWith(testCommand) && !isTesterContext()) {
      return block(`테스트/빌드/검증 명령은 tester 또는 docs-auditor subagent 산출물로만 인정됩니다: ${testCommand}`);
    }
  }
  return allow();
}

function hookPostEdit(input) {
  const filePath = normalizePath(input?.tool_input?.file_path || input?.tool_input?.path || "");
  if (!filePath) return allow();
  const requirements = docsRequirementsFor([filePath]);
  if (requirements.length > 0) {
    console.error("[harness] docs sync required:\n" + requirements.map((r) => `- ${r}`).join("\n"));
  }
  return allow();
}

function hookStop() {
  const plans = activePlans();
  if (plans.length === 0) return allow();
  const latest = plans[0];
  const text = read(latest);
  const missing = [];
  if (!/\[x\].*tester/i.test(text)) missing.push("tester result checklist");
  if (!/\[x\].*docs-auditor/i.test(text)) missing.push("docs-auditor checklist");
  if (!/Scripts Run/i.test(text)) missing.push("Scripts Run section");
  if (missing.length > 0) {
    return block(`active plan이 아직 완료 조건을 만족하지 않습니다: ${missing.join(", ")}`);
  }
  return allow();
}

function hookSubagentStop(input) {
  const transcript = input?.transcript_path;
  if (!transcript) return allow();
  return allow();
}

function writeManifest() {
  const manifest = buildManifest();
  writeJson(MANIFEST_PATH, manifest);
  console.log(`Wrote ${relative(ROOT, MANIFEST_PATH)}`);
}

function writeStructure() {
  const manifest = existsSync(MANIFEST_PATH) ? JSON.parse(read(MANIFEST_PATH)) : buildManifest();
  const lines = [
    "# SC Wonderland Structure",
    "",
    "This file is generated from `HARNESS_MANIFEST.json`. Run `npm run harness -- manifest` and `npm run harness -- structure` after structural changes.",
    "",
    "## Stack",
    "- Next.js 16 App Router, React 19, TypeScript, Tailwind CSS v4, Supabase.",
    "",
    "## Route Groups",
    ...Object.entries(groupBy(manifest.routes, (r) => r.group)).flatMap(([group, routes]) => [
      `### ${group}`,
      ...routes.map((r) => `- \`${r.url}\` -> \`${r.file}\` (${r.doc || "missing doc"})`),
      "",
    ]),
    "## Server Actions",
    ...manifest.actions.map((a) => `- \`${a.file}\` (${a.domain})`),
    "",
    "## Shared Components",
    ...Object.entries(groupBy(manifest.components, (c) => c.group)).flatMap(([group, components]) => [
      `### ${group}`,
      ...components.map((c) => `- \`${c.file}\``),
      "",
    ]),
    "## Harness Workflow",
    "1. Start on `main` and run `npm run harness -- worktree start <task-slug>`.",
    "2. Work only in the created `claude/<task-slug>` worktree.",
    "3. Create an active plan in `.claude/plans/active/` before code edits.",
    "4. Use worker subagents for implementation, tester for checks, docs-auditor for docs drift.",
    "5. Finish with `npm run harness -- finish <plan-file>` and return to `C:\\scwonderland`.",
    "",
    "## Required Checks",
    "- Base: `npm run check:auth`, `npm run lint`, `npm run type-check`.",
    "- Add `npm run build` for route/page/layout/server action/supabase/package changes.",
  ];
  writeFileSync(STRUCTURE_PATH, lines.join("\n") + "\n", "utf8");
  console.log(`Wrote ${relative(ROOT, STRUCTURE_PATH)}`);
}

function context(query) {
  const manifest = existsSync(MANIFEST_PATH) ? JSON.parse(read(MANIFEST_PATH)) : buildManifest();
  const hits = [];
  for (const route of manifest.routes) {
    if (query.includes(route.url) || query.includes(route.file) || route.doc?.includes(query)) hits.push(route);
  }
  console.log(JSON.stringify({ query, routes: hits, skills: inferSkills(query) }, null, 2));
}

function docsDetect() {
  const changed = gitChangedFiles();
  const requirements = docsRequirementsFor(changed);
  const changedSet = new Set(changed.map(normalizeSlash));
  const missing = requirements.filter((req) => !changedSet.has(req));
  const result = { changed, requiredDocs: requirements, missingDocs: missing };
  console.log(JSON.stringify(result, null, 2));
  if (missing.length > 0) process.exitCode = 1;
}

function validate() {
  const problems = [];
  const manifest = existsSync(MANIFEST_PATH) ? JSON.parse(read(MANIFEST_PATH)) : null;
  if (!manifest) problems.push("Missing HARNESS_MANIFEST.json");
  if (!existsSync(STRUCTURE_PATH)) problems.push("Missing STRUCTURE.md");
  for (const file of [
    ".claude/CLAUDE.md",
    ".claude/settings.json",
    ".claude/agents/worker.md",
    ".claude/agents/tester.md",
    ".claude/agents/docs-auditor.md",
  ]) {
    if (!existsSync(join(ROOT, file))) problems.push(`Missing ${file}`);
  }
  const routeDocs = new Set(listFiles(join(ROOT, ".claude", "routes"), (f) => f.endsWith(".md")).map((f) => basename(f)));
  for (const required of REQUIRED_ROUTE_DOCS) {
    if (!routeDocs.has(required)) problems.push(`Missing route doc ${required}`);
  }
  if (problems.length > 0) {
    console.error(problems.map((p) => `- ${p}`).join("\n"));
    process.exit(1);
  }
  console.log("[harness] validate OK");
}

function finish(planFile) {
  if (!planFile) fail("Usage: npm run harness -- finish <plan-file>");
  const planPath = resolve(ROOT, planFile);
  if (!existsSync(planPath)) fail(`Plan not found: ${planPath}`);
  const runId = currentRunId();
  const tester = join(RUNS_DIR, runId, "agents", "tester-result.json");
  const auditor = join(RUNS_DIR, runId, "agents", "docs-auditor-result.json");
  if (!existsSync(tester)) fail(`Missing tester result: ${relative(ROOT, tester)}`);
  if (!existsSync(auditor)) fail(`Missing docs-auditor result: ${relative(ROOT, auditor)}`);
  const testerResult = JSON.parse(read(tester));
  const auditorResult = JSON.parse(read(auditor));
  if (testerResult.status !== "pass") fail("Tester result is not pass.");
  if (auditorResult.status !== "pass") fail("Docs-auditor result is not pass.");
  const date = new Date().toISOString().slice(0, 10);
  const destDir = join(COMPLETED_PLANS_DIR, date);
  mkdirSync(destDir, { recursive: true });
  const dest = join(destDir, basename(planPath));
  renameSync(planPath, dest);
  console.log(`Moved plan to ${relative(ROOT, dest)}`);
}

function buildManifest() {
  return {
    generatedAt: new Date().toISOString(),
    project: "scwonderland",
    routes: scanRoutes(),
    actions: scanActions(),
    components: scanComponents(),
    docsSyncRules: DOCS_SYNC_RULES,
    requiredChecks: {
      base: ["npm run check:auth", "npm run lint", "npm run type-check"],
      structural: ["npm run build"],
      harness: ["npm run harness -- validate", "npm run harness -- docs detect"],
    },
  };
}

function scanRoutes() {
  const pages = listFiles(join(ROOT, "src", "app"), (f) => basename(f) === "page.tsx");
  return pages.map((file) => {
    const rel = normalizeSlash(relative(ROOT, file));
    const url = routeUrlFromPage(rel);
    return {
      url,
      group: rel.split("/")[2]?.replace(/[()]/g, "") || "app",
      file: rel,
      doc: routeDocForUrl(url),
    };
  }).sort((a, b) => a.url.localeCompare(b.url));
}

function scanActions() {
  const files = listFiles(join(ROOT, "src", "app", "(admin)", "admin", "actions"), (f) => /\.(ts|tsx)$/.test(f));
  return files.map((file) => ({
    file: normalizeSlash(relative(ROOT, file)),
    domain: basename(file).replace(/\.tsx?$/, ""),
  })).sort((a, b) => a.file.localeCompare(b.file));
}

function scanComponents() {
  const files = listFiles(join(ROOT, "src", "components"), (f) => /\.(ts|tsx)$/.test(f));
  return files.map((file) => {
    const rel = normalizeSlash(relative(ROOT, file));
    return { file: rel, group: rel.split("/")[2] || "components" };
  }).sort((a, b) => a.file.localeCompare(b.file));
}

function routeUrlFromPage(rel) {
  let parts = rel.split("/").slice(2, -1);
  parts = parts.filter((p) => !/^\(.+\)$/.test(p));
  const url = "/" + parts.join("/");
  return url === "/" ? "/" : url.replace(/\/page$/, "");
}

function routeDocForUrl(url) {
  const pairs = [
    [/^\/$/, "site-home.md"],
    [/^\/admin$/, "admin-dashboard.md"],
    [/^\/admin\/attendance/, "admin-attendance.md"],
    [/^\/admin\/reports/, "admin-reports.md"],
    [/^\/admin\/lunch\/settings/, "admin-lunch-settings.md"],
    [/^\/admin\/lunch/, "admin-lunch.md"],
    [/^\/admin\/weekly-sentences/, "admin-weekly-sentences.md"],
    [/^\/admin\/reservations/, "admin-reservations.md"],
    [/^\/admin\/students\/classes/, "admin-student-classes.md"],
    [/^\/admin\/students/, "admin-students.md"],
    [/^\/admin\/teachers/, "admin-teachers.md"],
    [/^\/admin\/classes/, "admin-classes.md"],
    [/^\/admin\/textbooks/, "admin-textbooks.md"],
    [/^\/admin\/notices/, "admin-notices.md"],
    [/^\/admin\/academy-notices/, "admin-academy-notices.md"],
    [/^\/admin\/timetable/, "admin-timetable.md"],
    [/^\/admin\/afterschool/, "admin-afterschool.md"],
    [/^\/admin\/bus/, "admin-bus.md"],
    [/^\/m\/attendance/, "admin-mobile-attendance.md"],
    [/^\/m\/bus-change/, "admin-mobile-bus-change.md"],
    [/^\/m\/bus-check/, "admin-mobile-bus-check.md"],
    [/^\/m$/, "admin-mobile.md"],
    [/^\/academy\/login|^\/academy\/dashboard/, "academy-login.md"],
    [/^\/academy\/student/, "academy-student.md"],
    [/^\/academy\/teacher/, "academy-teacher.md"],
    [/^\/bus$/, "bus-staff.md"],
    [/^\/bus-monitor/, "bus-monitor.md"],
    [/^\/lunch-monitor/, "lunch-monitor.md"],
    [/^\/about-wonderland/, "site-about.md"],
    [/^\/program/, "site-program.md"],
    [/^\/notice/, "site-notice.md"],
    [/^\/community/, "site-community.md"],
    [/^\/experience/, "site-experience.md"],
  ];
  return pairs.find(([pattern]) => pattern.test(url))?.[1] || null;
}

function docsRequirementsFor(files) {
  const required = new Set();
  for (const file of files.map(normalizeSlash)) {
    for (const rule of DOCS_SYNC_RULES) {
      if (rule.patterns.some((p) => globish(file, p))) {
        for (const doc of rule.docs) required.add(doc);
      }
    }
    const route = scanRoutes().find((r) => r.file === file);
    if (route?.doc) required.add(`.claude/routes/${route.doc}`);
  }
  return [...required].sort();
}

function globish(file, pattern) {
  const token = "__DOUBLE_STAR__";
  const rx = "^" + pattern
    .replace(/[.+?^${}()|[\]\\]/g, "\\$&")
    .replace(/\*\*/g, token)
    .replace(/\*/g, "[^/]*") + "$";
  return new RegExp(rx.replaceAll(token, ".*")).test(file);
}

const REQUIRED_ROUTE_DOCS = [
  "admin-attendance.md",
  "admin-reports.md",
  "admin-lunch.md",
  "admin-lunch-settings.md",
  "admin-weekly-sentences.md",
  "admin-reservations.md",
  "admin-student-classes.md",
  "admin-mobile.md",
  "admin-mobile-attendance.md",
  "admin-mobile-bus-change.md",
  "admin-mobile-bus-check.md",
  "lunch-monitor.md",
];

const DOCS_SYNC_RULES = [
  { patterns: ["src/app/**/page.tsx", "src/app/**/layout.tsx"], docs: ["STRUCTURE.md", ".claude/routes/_index.md"] },
  { patterns: ["src/lib/navigation/admin-nav.ts"], docs: ["STRUCTURE.md", ".claude/routes/_index.md"] },
  { patterns: ["src/lib/navigation/menu-routes.ts"], docs: ["STRUCTURE.md", ".claude/routes/_index.md"] },
  { patterns: ["src/app/(admin)/admin/actions/**"], docs: [".claude/rules/domain.md", ".claude/routes/shared-actions.md"] },
  { patterns: ["src/lib/types/**", "supabase/migrations/**"], docs: [".claude/rules/domain.md", ".claude/routes/shared-lib.md", "STRUCTURE.md"] },
  { patterns: ["src/components/**"], docs: [".claude/rules/domain.md", ".claude/routes/shared-components.md"] },
  { patterns: ["scripts/**", ".githooks/**", ".claude/settings.json", "package.json"], docs: ["STRUCTURE.md", ".claude/rules/workflow.md", ".claude/rules/testing.md"] },
];

function activePlans() {
  return listFiles(ACTIVE_PLANS_DIR, (f) => f.endsWith(".md"))
    .sort((a, b) => statSync(b).mtimeMs - statSync(a).mtimeMs);
}

function currentRunId() {
  const plans = activePlans();
  if (plans[0]) {
    const text = read(plans[0]);
    const match = /^Run ID:\s*(\S+)/m.exec(text);
    if (match) return match[1];
  }
  return "manual";
}

function inferSkills(query) {
  const skills = ["start-task"];
  if (/action|server|auth|supabase|rls/i.test(query)) skills.push("server-action-change");
  if (/route|page|admin|academy|bus|monitor|site/i.test(query)) skills.push("route-change");
  if (/doc|md|structure|manifest/i.test(query)) skills.push("docs-sync");
  if (/finish|complete|done/i.test(query)) skills.push("finish-task");
  return [...new Set(skills)];
}

function isProtectedPath(filePath) {
  const rel = normalizeSlash(relative(ROOT, filePath));
  return [
    "src/",
    "supabase/",
    "scripts/",
    ".githooks/",
    ".claude/settings.json",
    "package.json",
    "package-lock.json",
    "next.config.ts",
    "tsconfig.json",
  ].some((prefix) => rel === prefix.replace(/\/$/, "") || rel.startsWith(prefix));
}

function isTesterContext() {
  return process.env.HARNESS_AGENT === "tester" || process.env.HARNESS_AGENT === "docs-auditor";
}

function gitBranch() {
  return run("git", ["branch", "--show-current"]).trim();
}

function gitDirty() {
  return run("git", ["status", "--short"]).trim().length > 0;
}

function gitChangedFiles() {
  const out = run("git", ["diff", "--name-only", "main...HEAD"]);
  const unstaged = run("git", ["diff", "--name-only"]);
  const staged = run("git", ["diff", "--cached", "--name-only"]);
  const untracked = run("git", ["ls-files", "--others", "--exclude-standard"]);
  return [...new Set([
    ...out.split(/\r?\n/),
    ...unstaged.split(/\r?\n/),
    ...staged.split(/\r?\n/),
    ...untracked.split(/\r?\n/),
  ].filter(Boolean))];
}

function run(cmd, args, options = {}) {
  if (options.stdio === "inherit") {
    const result = spawnSync(cmd, args, { cwd: ROOT, stdio: "inherit", shell: false });
    if (result.status !== 0) fail(`${cmd} ${args.join(" ")} failed`);
    return "";
  }
  return execFileSync(cmd, args, { cwd: ROOT, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] });
}

function listFiles(dir, predicate, out = []) {
  if (!existsSync(dir)) return out;
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    const st = statSync(full);
    if (st.isDirectory()) {
      if (!["node_modules", ".next", ".git"].includes(name)) listFiles(full, predicate, out);
    } else if (!predicate || predicate(full)) {
      out.push(full);
    }
  }
  return out;
}

function groupBy(items, getKey) {
  return items.reduce((acc, item) => {
    const key = getKey(item);
    acc[key] ||= [];
    acc[key].push(item);
    return acc;
  }, {});
}

function normalizePath(value) {
  if (!value) return "";
  return resolve(ROOT, value);
}

function normalizeSlash(value) {
  return String(value).split(sep).join("/");
}

function read(file) {
  return readFileSync(file, "utf8");
}

function writeJson(file, data) {
  writeFileSync(file, JSON.stringify(data, null, 2) + "\n", "utf8");
}

function readStdinJson() {
  try {
    const raw = readFileSync(0, "utf8");
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

function allow() {
  process.exit(0);
}

function block(reason) {
  console.error(reason);
  process.exit(2);
}

function fail(message) {
  console.error(`[harness] ${message}`);
  process.exit(1);
}

main();
