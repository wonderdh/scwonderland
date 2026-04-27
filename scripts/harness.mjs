#!/usr/bin/env node
import { createHash } from "node:crypto";
import { execFileSync, spawnSync } from "node:child_process";
import {
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  renameSync,
  rmSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { basename, dirname, join, relative, resolve, sep } from "node:path";

const ROOT = process.env.CLAUDE_PROJECT_DIR
  ? resolve(process.env.CLAUDE_PROJECT_DIR)
  : resolve(process.cwd());
const WORKTREE_ROOT = process.env.HARNESS_WORKTREE_ROOT || "C:\\scwonderland-worktrees";
const MAIN_WORKTREE = process.env.HARNESS_MAIN_WORKTREE || "C:\\scwonderland";
const MANIFEST_PATH = join(ROOT, "HARNESS_MANIFEST.json");
const STRUCTURE_PATH = join(ROOT, "STRUCTURE.md");
const ACTIVE_PLANS_DIR = join(ROOT, ".claude", "plans", "active");
const COMPLETED_PLANS_DIR = join(ROOT, ".claude", "plans", "completed");
const RUNS_DIR = join(ROOT, ".claude", "runs");
const PLAN_TEMPLATE_PATH = join(ROOT, ".claude", "plans", "templates", "PLAN_TEMPLATE.md");

const REQUIRED_ROUTE_SECTIONS = [
  "## Route URL",
  "## Source Files",
  "## Related Actions / Types / Components",
  "## Required Reading",
  "## Required Checks",
  "## Manual Checks",
  "## Docs Sync Triggers",
];

const REQUIRED_PROJECT_FILES = [
  ".claude/CLAUDE.md",
  ".claude/settings.json",
  ".claude/hooks/harness-hook.ps1",
  ".claude/agents/worker.md",
  ".claude/agents/tester.md",
  ".claude/agents/docs-auditor.md",
  "scripts/harness.mjs",
  "scripts/harness-self-test.mjs",
  "HARNESS_MANIFEST.json",
  "STRUCTURE.md",
];

const PROTECTED_PATTERNS = [
  "src/**",
  "supabase/**",
  "scripts/**",
  ".githooks/**",
  ".claude/CLAUDE.md",
  ".claude/rules/**",
  ".claude/routes/**",
  ".claude/skills/**",
  ".claude/agents/**",
  ".claude/hooks/**",
  ".claude/settings.json",
  "HARNESS_MANIFEST.json",
  "STRUCTURE.md",
  "package.json",
  "package-lock.json",
  "next.config.*",
  "tsconfig*.json",
  "eslint.config.*",
  "postcss.config.*",
  "tailwind.config.*",
  "public/**",
  ".env*",
];

const STAGE_ALLOW_PATTERNS = [
  ".gitignore",
  ".githooks/**",
  ".claude/CLAUDE.md",
  ".claude/agents/**",
  ".claude/hooks/**",
  ".claude/plans/completed/**",
  ".claude/plans/templates/**",
  ".claude/routes/**",
  ".claude/rules/**",
  ".claude/settings.json",
  ".claude/skills/**",
  "HARNESS_MANIFEST.json",
  "STRUCTURE.md",
  "package.json",
  "package-lock.json",
  "scripts/**",
];

const STAGE_DENY_PATTERNS = [
  ".claude/runs/**",
  ".claude/plans/active/**",
  ".env*",
  "supabase/seed.sql",
  "supabase/.temp/**",
  "supabase/.branches/**",
];

const DOCS_SYNC_RULES = [
  { patterns: ["src/app/**/page.tsx", "src/app/**/layout.tsx"], docs: ["STRUCTURE.md", ".claude/routes/_index.md"] },
  { patterns: ["src/app/**/actions.ts", "src/app/**/actions/**", "src/app/**/*-actions.ts"], docs: [".claude/rules/domain.md", ".claude/routes/shared-actions.md"] },
  { patterns: ["src/lib/navigation/admin-nav.ts"], docs: ["STRUCTURE.md", ".claude/routes/_index.md"] },
  { patterns: ["src/lib/navigation/menu-routes.ts"], docs: ["STRUCTURE.md", ".claude/routes/_index.md"] },
  {
    patterns: [
      "src/lib/auth/**",
      "src/lib/bus/**",
      "src/lib/constants/**",
      "src/lib/hooks/**",
      "src/lib/lunch/**",
      "src/lib/server/**",
      "src/lib/supabase/**",
      "src/lib/ui/**",
      "src/lib/utils/**",
      "src/lib/types/**",
    ],
    docs: [".claude/rules/domain.md", ".claude/routes/shared-lib.md", "STRUCTURE.md"],
  },
  { patterns: ["supabase/migrations/**", "supabase/config.toml"], docs: [".claude/rules/domain.md", ".claude/routes/shared-lib.md", "STRUCTURE.md"] },
  { patterns: ["src/components/**"], docs: [".claude/rules/domain.md", ".claude/routes/shared-components.md"] },
  {
    patterns: [
      "scripts/**",
      ".githooks/**",
      ".claude/settings.json",
      ".claude/hooks/**",
      ".claude/skills/**",
      ".claude/agents/**",
      "package.json",
      "package-lock.json",
    ],
    docs: ["STRUCTURE.md", ".claude/rules/workflow.md", ".claude/rules/testing.md"],
  },
  { patterns: ["HARNESS_MANIFEST.json", "STRUCTURE.md"], docs: ["STRUCTURE.md", ".claude/rules/workflow.md"] },
];

function main() {
  const [, , ...args] = process.argv;
  const [cmd, sub, ...rest] = args;
  try {
    if (!cmd || cmd === "help") return help();
    if (cmd === "manifest") return writeManifest();
    if (cmd === "structure") return writeStructure();
    if (cmd === "context") return context(rest.join(" "));
    if (cmd === "docs" && sub === "detect") return docsDetect();
    if (cmd === "docs" && sub === "requirements") return docsRequirements(rest);
    if (cmd === "validate") return validate();
    if (cmd === "self-test") return selfTest();
    if (cmd === "precommit") return precommit();
    if (cmd === "run-info") return runInfo();
    if (cmd === "finish") return finish(sub);
    if (cmd === "commit") return commitTask(args.slice(1));
    if (cmd === "merge-main") return mergeMain(sub);
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
  npm run harness -- docs requirements <file...>
  npm run harness -- validate
  npm run harness -- self-test
  npm run harness -- precommit
  npm run harness -- run-info
  npm run harness -- finish <active-plan.md>
  npm run harness -- commit "<message>"
  npm run harness -- merge-main [branch]
  npm run harness -- worktree start <slug>
  npm run harness -- worktree status
  npm run harness -- worktree cleanup <slug>
  npm run harness -- hook pre-edit|pre-bash|post-edit|stop|subagent-stop|task-completed|teammate-idle
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
    if (!/^[a-z0-9][a-z0-9-]*$/.test(slug)) fail("Task slug must use lowercase letters, numbers, and hyphens.");
    const branch = `claude/${slug}`;
    const target = join(WORKTREE_ROOT, slug);
    if (gitBranch() !== "main") fail("Start worktrees from main only.");
    if (gitDirty()) fail("Main worktree is dirty. Commit/stash before starting a task worktree.");
    mkdirSync(WORKTREE_ROOT, { recursive: true });
    run("git", ["worktree", "add", "-b", branch, target, "main"], { stdio: "inherit" });
    const runId = `${todayKst()}-${slug}`;
    createInitialPlan(target, runId, branch, target);
    mkdirSync(join(target, ".claude", "runs", runId, "agents"), { recursive: true });
    console.log(`Created worktree ${target} on ${branch}`);
    console.log(`Created active plan .claude/plans/active/${runId}.md`);
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
  if (kind === "subagent-stop") return hookAgentStop(input);
  if (kind === "task-completed") return hookAgentStop(input);
  if (kind === "teammate-idle") return hookAgentStop(input);
  fail(`Unknown hook: ${kind}`);
}

function hookPreEdit(input) {
  const filePath = input?.tool_input?.file_path || input?.tool_input?.path || "";
  const normalized = repoPath(filePath);
  if (!filePath) return allow();
  if (!normalized.inside) return block("Repository 밖 파일 수정은 하네스에서 차단됩니다.");
  if (!isProtectedPath(normalized.rel)) return allow();
  if (policyBranch() === "main") {
    return block("main branch에서는 protected 파일 수정이 금지됩니다. `npm run harness -- worktree start <task-slug>`로 작업 worktree를 만드세요.");
  }
  const plans = activePlans();
  if (plans.length === 0) return block("active plan이 없습니다. `.claude/plans/active/`에 plan을 작성한 뒤 수정하세요.");
  if (plans.length > 1) return block(`active plan이 ${plans.length}개입니다. 한 작업에는 active plan 1개만 허용됩니다.`);
  return allow();
}

function hookPreBash(input) {
  const command = String(input?.tool_input?.command || "").trim();
  if (!command) return allow();
  if (isDirectGitPublishCommand(command)) {
    return block("직접 git publish 명령은 차단됩니다. `npm run harness -- commit` 또는 `npm run harness -- merge-main`을 사용하세요.");
  }
  if (isTestOrBuildCommand(command) && !isValidationAgentContext()) {
    return block("테스트/빌드/검증 명령은 tester 또는 docs-auditor subagent 컨텍스트에서만 실행할 수 있습니다.");
  }
  if (policyBranch() === "main" && isShellMutationCommand(command)) {
    return block("main branch에서 shell 기반 파일 수정 명령은 차단됩니다. 작업 worktree에서 수행하세요.");
  }
  return allow();
}

function hookPostEdit(input) {
  const filePath = input?.tool_input?.file_path || input?.tool_input?.path || "";
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
  if (plans.length > 1) return block(`active plan이 ${plans.length}개입니다. 하나만 남기세요.`);
  const text = read(plans[0]);
  const missing = [];
  if (!/\[x\].*tester result recorded/i.test(text)) missing.push("tester result checklist");
  if (!/\[x\].*docs-auditor result recorded/i.test(text)) missing.push("docs-auditor checklist");
  if (!/Scripts Run/i.test(text)) missing.push("Scripts Run section");
  if (missing.length > 0) return block(`active plan이 아직 완료 조건을 만족하지 않습니다: ${missing.join(", ")}`);
  return allow();
}

function hookAgentStop(input) {
  const agent = String(input?.agent || input?.agent_type || input?.subagent_type || "").toLowerCase();
  if (!["tester", "docs-auditor"].includes(agent)) return allow();
  const runId = process.env.HARNESS_RUN_ID || currentRunId();
  const resultPath = join(RUNS_DIR, runId, "agents", `${agent}-result.json`);
  if (!existsSync(resultPath)) return block(`${agent} result JSON이 없습니다: ${relative(ROOT, resultPath)}`);
  const result = JSON.parse(read(resultPath));
  const problems = validateAgentResult(agent, result, runId, { requireCurrentState: false });
  if (problems.length > 0) return block(`${agent} result JSON 형식 오류:\n- ${problems.join("\n- ")}`);
  return allow();
}

function context(queryArg) {
  const input = readStdinJsonIfAvailable();
  const prompt = input?.prompt || "";
  const query = [queryArg, prompt].filter(Boolean).join(" ");
  const manifest = existsSync(MANIFEST_PATH) ? JSON.parse(read(MANIFEST_PATH)) : buildManifest();
  const hits = [];
  for (const route of manifest.routes) {
    if (query.includes(route.url) || query.includes(route.file) || route.doc && query.includes(route.doc)) hits.push(route);
  }
  console.log(JSON.stringify({ query, routes: hits, skills: inferSkills(query), checks: manifest.requiredChecks }, null, 2));
}

function docsDetect() {
  const changed = gitChangedFiles();
  const requirements = docsRequirementsFor(changed);
  const changedSet = new Set(changed.map((f) => repoPath(f).rel).filter(Boolean));
  const missing = requirements.filter((req) => !changedSet.has(req));
  const result = { changed, requiredDocs: requirements, missingDocs: missing };
  console.log(JSON.stringify(result, null, 2));
  if (missing.length > 0) process.exitCode = 1;
}

function docsRequirements(files) {
  const requirements = docsRequirementsFor(files);
  console.log(JSON.stringify({ files, requiredDocs: requirements }, null, 2));
  if (requirements.length === 0) process.exitCode = 1;
}

function validate() {
  const problems = [];
  for (const file of REQUIRED_PROJECT_FILES) {
    if (!existsSync(join(ROOT, file))) problems.push(`Missing ${file}`);
  }

  const manifest = existsSync(MANIFEST_PATH) ? JSON.parse(read(MANIFEST_PATH)) : null;
  const expectedManifest = buildManifest();
  if (manifest) {
    if (JSON.stringify(manifest, null, 2) + "\n" !== JSON.stringify(expectedManifest, null, 2) + "\n") {
      problems.push("HARNESS_MANIFEST.json is stale. Run `npm run harness -- manifest`.");
    }
    for (const route of manifest.routes || []) {
      if (!route.doc) problems.push(`Route has no doc mapping: ${route.url} (${route.file})`);
      if (route.doc && !existsSync(join(ROOT, ".claude", "routes", route.doc))) problems.push(`Missing route doc ${route.doc}`);
    }
    for (const route of manifest.routes || []) {
      if (route.doc) {
        const docPath = join(ROOT, ".claude", "routes", route.doc);
        if (existsSync(docPath)) {
          const text = read(docPath);
          for (const section of REQUIRED_ROUTE_SECTIONS) {
            if (!hasRouteSection(text, section)) problems.push(`${route.doc} missing ${section}`);
          }
        }
      }
    }
    const sharedActions = existsSync(join(ROOT, ".claude", "routes", "shared-actions.md"))
      ? read(join(ROOT, ".claude", "routes", "shared-actions.md"))
      : "";
    for (const action of manifest.actions || []) {
      if (!sharedActions.includes(action.file) && !sharedActions.includes(basename(action.file))) {
        problems.push(`Action not referenced in shared-actions.md: ${action.file}`);
      }
    }
  }

  const expectedStructure = buildStructureText(expectedManifest);
  if (existsSync(STRUCTURE_PATH) && read(STRUCTURE_PATH) !== expectedStructure) {
    problems.push("STRUCTURE.md is stale. Run `npm run harness -- structure`.");
  }

  if (problems.length > 0) {
    console.error(problems.map((p) => `- ${p}`).join("\n"));
    process.exit(1);
  }
  console.log("[harness] validate OK");
}

function selfTest() {
  const result = spawnSync(process.execPath, [join(ROOT, "scripts", "harness-self-test.mjs")], {
    cwd: ROOT,
    stdio: "inherit",
    shell: false,
    env: { ...process.env, CLAUDE_PROJECT_DIR: ROOT },
  });
  if (result.status !== 0) process.exit(result.status || 1);
}

function precommit() {
  validate();
  const plans = activePlans();
  if (plans.length > 0) fail("Active plans remain. Run `npm run harness -- finish <plan-file>` before commit.");
  console.log("[harness] precommit OK");
}

function runInfo() {
  const plan = currentPlanData();
  const info = {
    run_id: plan?.runId || currentRunId(),
    branch: gitBranch(),
    worktree: ROOT,
    commit_head: gitHead(),
    worktree_hash: worktreeStateHash(),
    status: gitStatusShort(),
  };
  console.log(JSON.stringify(info, null, 2));
}

function finish(planFile) {
  if (!planFile) fail("Usage: npm run harness -- finish <plan-file>");
  const planPath = resolve(ROOT, planFile);
  if (!isInside(planPath, ACTIVE_PLANS_DIR)) fail("finish 대상 plan은 `.claude/plans/active/` 아래에 있어야 합니다.");
  if (!existsSync(planPath)) fail(`Plan not found: ${planPath}`);
  if (activePlans().length !== 1) fail("finish 전에 active plan은 정확히 1개여야 합니다.");

  const plan = parsePlan(read(planPath));
  const runId = plan.runId;
  if (!runId) fail("Plan에 `Run ID:`가 없습니다.");
  if (plan.branch && plan.branch !== gitBranch()) fail(`Plan branch mismatch: ${plan.branch} !== ${gitBranch()}`);
  if (plan.worktree && resolve(plan.worktree) !== ROOT) fail(`Plan worktree mismatch: ${plan.worktree} !== ${ROOT}`);

  const tester = readAgentResult(runId, "tester");
  const auditor = readAgentResult(runId, "docs-auditor");
  const testerProblems = validateAgentResult("tester", tester, runId, { requireCurrentState: true });
  const auditorProblems = validateAgentResult("docs-auditor", auditor, runId, { requireCurrentState: true });
  if (testerProblems.length > 0) fail(`Tester result invalid:\n- ${testerProblems.join("\n- ")}`);
  if (auditorProblems.length > 0) fail(`Docs-auditor result invalid:\n- ${auditorProblems.join("\n- ")}`);

  const docs = docsDetectResult();
  if (docs.missingDocs.length > 0) fail(`Docs sync missing:\n- ${docs.missingDocs.join("\n- ")}`);

  const text = read(planPath);
  const checklist = [
    "Active plan exists before code edits",
    "Worker implementation complete",
    "Docs sync complete",
    "tester result recorded",
    "docs-auditor result recorded",
    "Required checks passed",
  ];
  const missingChecklist = checklist.filter((item) => !new RegExp(`\\[x\\]\\s+${escapeRegExp(item)}`, "i").test(text));
  if (missingChecklist.length > 0) fail(`Plan checklist incomplete:\n- ${missingChecklist.join("\n- ")}`);
  if (/Docs Sync Exception\s+[\s\S]*?(?!없음)/i.test(text) && !auditor.docs_exception_approved) {
    fail("Docs Sync Exception requires docs-auditor approval.");
  }

  const destDir = COMPLETED_PLANS_DIR;
  mkdirSync(destDir, { recursive: true });
  const dest = join(destDir, basename(planPath));
  if (existsSync(dest)) rmSync(dest);
  renameSync(planPath, dest);
  writeCommitIntent(runId, dest);
  console.log(`Moved plan to ${relative(ROOT, dest)}`);
  console.log(`Next: npm run harness -- commit "<message>"`);
  console.log(`Then: npm run harness -- merge-main ${gitBranch()}`);
}

function commitTask(args) {
  const message = args.join(" ").trim();
  if (!message) fail('Usage: npm run harness -- commit "<message>"');
  if (gitBranch() === "main") fail("Do not create task commits on main.");
  if (activePlans().length > 0) fail("Active plans remain. Run `npm run harness -- finish <plan-file>` first.");
  const intent = latestCommitIntent();
  if (!intent) fail("No completed plan/run intent found. Run `npm run harness -- finish <plan-file>` first.");
  const changed = gitStatusFiles();
  const disallowed = changed.filter((file) => !isAllowedStagePath(file) || isDeniedStagePath(file));
  if (disallowed.length > 0) fail(`Refusing to stage disallowed files:\n- ${disallowed.join("\n- ")}`);
  if (changed.length === 0) {
    console.log("[harness] Nothing to commit.");
    return;
  }
  run("git", ["add", "--", ...changed], { stdio: "inherit" });
  if (!gitDirty()) {
    console.log("[harness] Nothing to commit.");
    return;
  }
  run("git", ["commit", "-m", message], { stdio: "inherit" });
  const commit = gitHead();
  const commitResult = {
    run_id: intent.run_id,
    branch: gitBranch(),
    worktree: ROOT,
    commit_head: commit,
    completed_plan: intent.completed_plan,
    committed_at: new Date().toISOString(),
  };
  writeJson(join(RUNS_DIR, intent.run_id, "commit-result.json"), commitResult);
  console.log(`[harness] committed ${commit}`);
}

function mergeMain(branchArg) {
  const branch = branchArg || gitBranch();
  if (!branch || branch === "main") fail("Usage: npm run harness -- merge-main <task-branch>");
  if (!existsSync(MAIN_WORKTREE)) fail(`Main worktree not found: ${MAIN_WORKTREE}`);
  if (runIn(MAIN_WORKTREE, "git", ["branch", "--show-current"]).trim() !== "main") {
    fail(`Main worktree is not on main: ${MAIN_WORKTREE}`);
  }
  if (runIn(MAIN_WORKTREE, "git", ["status", "--short"]).trim()) fail("Main worktree is dirty. Commit/stash before merge.");

  const branchHead = run("git", ["rev-parse", branch]).trim();
  const currentBranch = gitBranch();
  if (currentBranch === branch) {
    if (gitDirty()) fail("Task worktree is dirty. Commit or clean before merge.");
    const commit = latestCommitResult();
    if (!commit) fail("Missing harness commit-result.json. Run `npm run harness -- commit` from the task worktree.");
    if (commit.commit_head !== branchHead) fail(`Branch HEAD is not the harness-committed HEAD: ${branchHead} !== ${commit.commit_head}`);
  }

  runIn(MAIN_WORKTREE, "git", ["merge", "--no-ff", branch], { stdio: "inherit" });
  runIn(MAIN_WORKTREE, "npm", ["run", "harness", "--", "validate"], { stdio: "inherit" });
  console.log(`[harness] Merged ${branch} into main at ${MAIN_WORKTREE}`);
  console.log(`[harness] Return to ${MAIN_WORKTREE}`);
}

function writeManifest() {
  writeJson(MANIFEST_PATH, buildManifest());
  console.log(`Wrote ${relative(ROOT, MANIFEST_PATH)}`);
}

function writeStructure() {
  writeFileSync(STRUCTURE_PATH, buildStructureText(buildManifest()), "utf8");
  console.log(`Wrote ${relative(ROOT, STRUCTURE_PATH)}`);
}

function buildManifest() {
  return {
    project: "scwonderland",
    routes: scanRoutes(),
    actions: scanActions(),
    components: scanComponents(),
    docsSyncRules: DOCS_SYNC_RULES,
    protectedPatterns: PROTECTED_PATTERNS,
    requiredChecks: {
      base: ["npm run check:auth", "npm run lint", "npm run type-check"],
      structural: ["npm run build"],
      harness: ["npm run harness -- validate", "npm run harness -- self-test", "npm run harness -- docs detect"],
    },
  };
}

function buildStructureText(manifest) {
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
    "3. Keep exactly one active plan in `.claude/plans/active/` before protected edits.",
    "4. Use worker subagents for implementation, tester for checks, docs-auditor for docs drift.",
    "5. Finish with `npm run harness -- finish <plan-file>`.",
    "6. Commit with `npm run harness -- commit \"<message>\"`.",
    "7. Merge into main with `npm run harness -- merge-main [branch]`, then return to `C:\\scwonderland`.",
    "",
    "## Required Checks",
    "- Base: `npm run check:auth`, `npm run lint`, `npm run type-check`.",
    "- Harness: `npm run harness -- validate`, `npm run harness -- self-test`, `npm run harness -- docs detect`.",
    "- Add `npm run build` for route/page/layout/server action/supabase/package/harness changes.",
    "",
    "## Protected Paths",
    ...PROTECTED_PATTERNS.map((p) => `- \`${p}\``),
    "",
    "## Docs Sync Rules",
    ...DOCS_SYNC_RULES.map((rule) => `- \`${rule.patterns.join("`, `")}\` -> ${rule.docs.map((d) => `\`${d}\``).join(", ")}`),
    "",
  ];
  return lines.join("\n") + "\n";
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
  }).sort((a, b) => a.url.localeCompare(b.url) || a.file.localeCompare(b.file));
}

function scanActions() {
  const files = listFiles(join(ROOT, "src", "app"), (f) => {
    const rel = normalizeSlash(relative(ROOT, f));
    return /\.(ts|tsx)$/.test(f)
      && (rel.endsWith("/actions.ts") || rel.includes("/actions/") || /-actions\.tsx?$/.test(rel));
  });
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
  const routes = scanRoutes();
  for (const input of files) {
    const info = repoPath(input);
    if (!info.inside) continue;
    const file = info.rel;
    for (const rule of DOCS_SYNC_RULES) {
      if (rule.patterns.some((p) => globish(file, p))) {
        for (const doc of rule.docs) required.add(doc);
      }
    }
    const directRoute = routes.find((r) => r.file === file);
    if (directRoute?.doc) required.add(`.claude/routes/${directRoute.doc}`);
    const ownedRoute = routeForOwnedFile(file, routes);
    if (ownedRoute?.doc) required.add(`.claude/routes/${ownedRoute.doc}`);
  }
  return [...required].sort();
}

function routeForOwnedFile(file, routes) {
  if (!file.startsWith("src/app/")) return null;
  const candidates = routes
    .map((route) => ({ route, dir: normalizeSlash(dirname(route.file)) }))
    .filter(({ dir }) => file === dir || file.startsWith(`${dir}/`))
    .sort((a, b) => b.dir.length - a.dir.length);
  return candidates[0]?.route || null;
}

function docsDetectResult() {
  const changed = gitChangedFiles();
  const requirements = docsRequirementsFor(changed);
  const changedSet = new Set(changed.map((f) => repoPath(f).rel).filter(Boolean));
  const missingDocs = requirements.filter((req) => !changedSet.has(req));
  return { changed, requiredDocs: requirements, missingDocs };
}

function validateAgentResult(agent, result, runId, options = {}) {
  const problems = [];
  if (!result || typeof result !== "object") return ["result is not an object"];
  if (result.status !== "pass") problems.push("status must be pass");
  if (result.agent !== agent) problems.push(`agent must be ${agent}`);
  if (result.run_id !== runId) problems.push(`run_id must be ${runId}`);
  if (result.branch !== gitBranch()) problems.push(`branch must be ${gitBranch()}`);
  if (resolve(String(result.worktree || "")) !== ROOT) problems.push(`worktree must be ${ROOT}`);
  if (result.commit_head !== gitHead()) problems.push(`commit_head must be ${gitHead()}`);
  if (options.requireCurrentState && result.worktree_hash !== worktreeStateHash()) problems.push("worktree_hash does not match current worktree state");
  if (!Array.isArray(result.commands_run)) problems.push("commands_run must be an array");
  if (!Array.isArray(result.failures)) problems.push("failures must be an array");
  if (Array.isArray(result.failures) && result.failures.length > 0) problems.push("failures must be empty");
  if (typeof result.summary !== "string") problems.push("summary must be a string");
  return problems;
}

function readAgentResult(runId, agent) {
  const file = join(RUNS_DIR, runId, "agents", `${agent}-result.json`);
  if (!existsSync(file)) fail(`Missing ${agent} result: ${relative(ROOT, file)}`);
  return JSON.parse(read(file));
}

function writeCommitIntent(runId, completedPlan) {
  writeJson(join(RUNS_DIR, runId, "commit-intent.json"), {
    run_id: runId,
    completed_plan: normalizeSlash(relative(ROOT, completedPlan)),
    branch: gitBranch(),
    worktree: ROOT,
    commit_head: gitHead(),
    worktree_hash: worktreeStateHash(),
  });
}

function latestCommitIntent() {
  const files = listFiles(RUNS_DIR, (f) => basename(f) === "commit-intent.json");
  if (files.length === 0) return null;
  files.sort((a, b) => statSync(b).mtimeMs - statSync(a).mtimeMs);
  return JSON.parse(read(files[0]));
}

function latestCommitResult() {
  const files = listFiles(RUNS_DIR, (f) => basename(f) === "commit-result.json");
  if (files.length === 0) return null;
  files.sort((a, b) => statSync(b).mtimeMs - statSync(a).mtimeMs);
  return JSON.parse(read(files[0]));
}

function createInitialPlan(target, runId, branch, worktreePath) {
  const activeDir = join(target, ".claude", "plans", "active");
  mkdirSync(activeDir, { recursive: true });
  const planPath = join(activeDir, `${runId}.md`);
  const template = existsSync(join(target, ".claude", "plans", "templates", "PLAN_TEMPLATE.md"))
    ? read(join(target, ".claude", "plans", "templates", "PLAN_TEMPLATE.md"))
    : read(PLAN_TEMPLATE_PATH);
  const text = template
    .replace(/^Run ID:\s*.*$/m, `Run ID: ${runId}`)
    .replace(/^Branch:\s*.*$/m, `Branch: ${branch}`)
    .replace(/^Worktree:\s*.*$/m, `Worktree: ${worktreePath}`);
  writeFileSync(planPath, text, "utf8");
}

function currentPlanData() {
  const plans = activePlans();
  if (!plans[0]) return null;
  return parsePlan(read(plans[0]));
}

function parsePlan(text) {
  return {
    runId: /^Run ID:\s*(\S+)/m.exec(text)?.[1] || "",
    branch: /^Branch:\s*(\S+)/m.exec(text)?.[1] || "",
    worktree: /^Worktree:\s*(.+)$/m.exec(text)?.[1]?.trim() || "",
  };
}

function currentRunId() {
  return currentPlanData()?.runId || process.env.HARNESS_RUN_ID || "manual";
}

function inferSkills(query) {
  const skills = ["start-task"];
  if (/action|server|auth|supabase|rls/i.test(query)) skills.push("server-action-change");
  if (/route|page|admin|academy|bus|monitor|site/i.test(query)) skills.push("route-change");
  if (/doc|md|structure|manifest/i.test(query)) skills.push("docs-sync");
  if (/finish|complete|done/i.test(query)) skills.push("finish-task");
  return [...new Set(skills)];
}

function isDirectGitPublishCommand(command) {
  return /(^|[;&|]\s*)git\s+(add|commit|merge|checkout|switch|reset|rebase|cherry-pick)\b/i.test(command)
    || /(^|[;&|]\s*)git\s+worktree\s+(add|remove|prune)\b/i.test(command);
}

function isTestOrBuildCommand(command) {
  const normalized = command.replace(/\s+/g, " ").toLowerCase();
  return [
    /\bnpm\s+run\s+(check:auth|lint|type-check|build)\b/,
    /\bnpm\s+(test|run\s+test)\b/,
    /\bnpx\s+tsc\b/,
    /\btsc\s+--noemit\b/,
    /\bnpm\s+exec\s+tsc\b/,
    /\bnpx\s+next\s+build\b/,
    /\bnext\s+build\b/,
    /\bpnpm\s+(lint|test|build)\b/,
    /\byarn\s+(lint|test|build)\b/,
    /\bnpm\s+run\s+harness\s+--\s+(validate|self-test|docs detect)\b/,
  ].some((pattern) => pattern.test(normalized));
}

function isValidationAgentContext() {
  const agent = process.env.HARNESS_AGENT;
  const runId = process.env.HARNESS_RUN_ID;
  if (!["tester", "docs-auditor"].includes(agent)) return false;
  if (process.env.HARNESS_SELF_TEST === "1") return true;
  if (!runId) return false;
  return existsSync(join(RUNS_DIR, runId));
}

function isShellMutationCommand(command) {
  const normalized = command.replace(/\s+/g, " ").toLowerCase();
  const mutates = [
    /\bset-content\b/,
    /\bout-file\b/,
    /\bnew-item\b/,
    /\bremove-item\b/,
    /\bmove-item\b/,
    /\bcopy-item\b/,
    /(^|[;&|]\s*)(rm|del|erase|mv|move|cp|copy|tee)\b/,
    /(^|[^<])>>?/,
  ].some((pattern) => pattern.test(normalized));
  if (!mutates) return false;
  return commandMentionsProtectedPath(normalized) || /(^|[^<])>>?/.test(normalized);
}

function commandMentionsProtectedPath(command) {
  return [
    "src",
    "supabase",
    "scripts",
    ".githooks",
    ".claude",
    "harness_manifest.json",
    "structure.md",
    "package.json",
    "package-lock.json",
    "next.config",
    "tsconfig",
    "eslint.config",
    "postcss.config",
    "tailwind.config",
    "public",
    ".env",
  ].some((token) => command.includes(token));
}

function hasRouteSection(text, section) {
  if (text.includes(section)) return true;
  const legacy = {
    "## Route URL": ["## 라우트 경로"],
    "## Source Files": ["## 핵심 파일"],
    "## Related Actions / Types / Components": ["## 컴포넌트", "## Server Actions", "## 타입", "## 의존성"],
    "## Required Reading": ["## 의존성"],
    "## Required Checks": ["## 주의사항"],
    "## Manual Checks": ["## 주의사항"],
    "## Docs Sync Triggers": ["## 주의사항"],
  };
  return (legacy[section] || []).some((candidate) => text.includes(candidate));
}

function isProtectedPath(relPath) {
  return PROTECTED_PATTERNS.some((pattern) => globish(relPath, pattern));
}

function isAllowedStagePath(relPath) {
  return STAGE_ALLOW_PATTERNS.some((pattern) => globish(relPath, pattern));
}

function isDeniedStagePath(relPath) {
  return STAGE_DENY_PATTERNS.some((pattern) => globish(relPath, pattern));
}

function activePlans() {
  const forced = process.env.HARNESS_SELF_TEST === "1" ? process.env.HARNESS_SELF_TEST_ACTIVE_PLAN_COUNT : "";
  if (forced) return Array.from({ length: Number(forced) }, (_, i) => join(ACTIVE_PLANS_DIR, `self-test-${i}.md`));
  return listFiles(ACTIVE_PLANS_DIR, (f) => f.endsWith(".md"))
    .sort((a, b) => statSync(b).mtimeMs - statSync(a).mtimeMs);
}

function policyBranch() {
  if (process.env.HARNESS_SELF_TEST === "1" && process.env.HARNESS_SELF_TEST_BRANCH) {
    return process.env.HARNESS_SELF_TEST_BRANCH;
  }
  return gitBranch();
}

function repoPath(value) {
  if (!value) return { inside: false, rel: "" };
  const abs = resolve(ROOT, String(value));
  if (!isInside(abs, ROOT)) return { inside: false, rel: normalizeSlash(abs) };
  return { inside: true, rel: normalizeSlash(relative(ROOT, abs)) || "." };
}

function isInside(child, parent) {
  const rel = relative(resolve(parent), resolve(child));
  return rel === "" || (!rel.startsWith("..") && !resolve(rel).startsWith("\\\\"));
}

function globish(file, pattern) {
  const token = "__DOUBLE_STAR__";
  const rx = "^" + pattern
    .replace(/[.+?^${}()|[\]\\]/g, "\\$&")
    .replace(/\*\*/g, token)
    .replace(/\*/g, "[^/]*") + "$";
  return new RegExp(rx.replaceAll(token, ".*")).test(file);
}

function groupBy(items, getKey) {
  return items.reduce((acc, item) => {
    const key = getKey(item);
    acc[key] ||= [];
    acc[key].push(item);
    return acc;
  }, {});
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

function gitBranch() {
  return run("git", ["branch", "--show-current"]).trim();
}

function gitHead() {
  return run("git", ["rev-parse", "HEAD"]).trim();
}

function gitDirty() {
  return gitStatusShort().length > 0;
}

function gitStatusShort() {
  return run("git", ["status", "--short"]).trim();
}

function gitStatusFiles() {
  const out = run("git", ["status", "--porcelain=v1"]);
  return [...new Set(out.split(/\r?\n/).filter(Boolean).map((line) => line.slice(3).trim().replace(/^"|"$/g, "")).map(normalizeSlash))];
}

function gitChangedFiles() {
  let branchDiff = "";
  try {
    branchDiff = run("git", ["diff", "--name-only", "main...HEAD"]);
  } catch {
    branchDiff = "";
  }
  const unstaged = run("git", ["diff", "--name-only"]);
  const staged = run("git", ["diff", "--cached", "--name-only"]);
  const untracked = run("git", ["ls-files", "--others", "--exclude-standard"]);
  return [...new Set([
    ...branchDiff.split(/\r?\n/),
    ...unstaged.split(/\r?\n/),
    ...staged.split(/\r?\n/),
    ...untracked.split(/\r?\n/),
  ].filter(Boolean).map(normalizeSlash))];
}

function worktreeStateHash() {
  const payload = [
    gitHead(),
    run("git", ["status", "--porcelain=v1"]),
    run("git", ["diff", "--binary"]),
    run("git", ["diff", "--cached", "--binary"]),
    run("git", ["ls-files", "--others", "--exclude-standard"]),
  ].join("\n---\n");
  return createHash("sha256").update(payload).digest("hex");
}

function todayKst() {
  const now = new Date();
  const kst = new Date(now.getTime() + 9 * 60 * 60 * 1000);
  return kst.toISOString().slice(0, 10);
}

function run(cmd, args, options = {}) {
  if (options.stdio === "inherit") {
    const result = spawnSync(cmd, args, { cwd: ROOT, stdio: "inherit", shell: false, env: { ...process.env, HARNESS_INTERNAL: "1" } });
    if (result.status !== 0) fail(`${cmd} ${args.join(" ")} failed`);
    return "";
  }
  return execFileSync(cmd, args, { cwd: ROOT, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"], env: { ...process.env, HARNESS_INTERNAL: "1" } });
}

function runIn(cwd, cmd, args, options = {}) {
  if (options.stdio === "inherit") {
    const result = spawnSync(cmd, args, { cwd, stdio: "inherit", shell: false, env: { ...process.env, HARNESS_INTERNAL: "1" } });
    if (result.status !== 0) fail(`${cmd} ${args.join(" ")} failed in ${cwd}`);
    return "";
  }
  return execFileSync(cmd, args, { cwd, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"], env: { ...process.env, HARNESS_INTERNAL: "1" } });
}

function normalizeSlash(value) {
  return String(value).split(sep).join("/");
}

function read(file) {
  return readFileSync(file, "utf8");
}

function writeJson(file, data) {
  mkdirSync(dirname(file), { recursive: true });
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

function readStdinJsonIfAvailable() {
  if (process.stdin.isTTY) return {};
  return readStdinJson();
}

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
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
