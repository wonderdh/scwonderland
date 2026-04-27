#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import { mkdirSync } from "node:fs";
import { join, resolve } from "node:path";

const ROOT = process.env.CLAUDE_PROJECT_DIR
  ? resolve(process.env.CLAUDE_PROJECT_DIR)
  : resolve(process.cwd());

const tests = [];

function test(name, fn) {
  tests.push({ name, fn });
}

function runHarness(args, input, env = {}) {
  return spawnSync(process.execPath, ["scripts/harness.mjs", ...args], {
    cwd: ROOT,
    input: input ? JSON.stringify(input) : "",
    encoding: "utf8",
    shell: false,
    env: {
      ...process.env,
      CLAUDE_PROJECT_DIR: ROOT,
      HARNESS_SELF_TEST: "1",
      ...env,
    },
  });
}

function expectExit(name, result, expected) {
  if (result.status !== expected) {
    throw new Error(`${name}: expected exit ${expected}, got ${result.status}\nstdout:\n${result.stdout}\nstderr:\n${result.stderr}`);
  }
}

test("main protected src edit blocked", () => {
  const result = runHarness(["hook", "pre-edit"], {
    tool_input: { file_path: join(ROOT, "src", "self-test.ts") },
  }, { HARNESS_SELF_TEST_BRANCH: "main" });
  expectExit("main protected src edit blocked", result, 2);
});

test("repo outside edit blocked", () => {
  const result = runHarness(["hook", "pre-edit"], {
    tool_input: { file_path: "C:\\outside-project\\src\\oops.ts" },
  }, { HARNESS_SELF_TEST_BRANCH: "claude/self-test", HARNESS_SELF_TEST_ACTIVE_PLAN_COUNT: "1" });
  expectExit("repo outside edit blocked", result, 2);
});

for (const file of ["HARNESS_MANIFEST.json", "STRUCTURE.md", ".claude/rules/workflow.md", ".claude/routes/_index.md"]) {
  test(`main protected ${file} edit blocked`, () => {
    const result = runHarness(["hook", "pre-edit"], {
      tool_input: { file_path: join(ROOT, file) },
    }, { HARNESS_SELF_TEST_BRANCH: "main" });
    expectExit(`main protected ${file} edit blocked`, result, 2);
  });
}

test("duplicate active plans block protected edit", () => {
  const result = runHarness(["hook", "pre-edit"], {
    tool_input: { file_path: join(ROOT, "src", "self-test.ts") },
  }, { HARNESS_SELF_TEST_BRANCH: "claude/self-test", HARNESS_SELF_TEST_ACTIVE_PLAN_COUNT: "2" });
  expectExit("duplicate active plans block protected edit", result, 2);
});

for (const command of [
  "Set-Content -Path src\\bypass.ts -Value test",
  "cmd /c npm run lint",
  "powershell -Command \"npm run lint\"",
  "npx tsc --noEmit",
  "npx next build",
  "npm test",
  "git add . && git commit -m test",
  "git merge claude/foo",
]) {
  test(`bash blocked: ${command}`, () => {
    const result = runHarness(["hook", "pre-bash"], {
      tool_input: { command },
    }, { HARNESS_SELF_TEST_BRANCH: "main" });
    expectExit(`bash blocked: ${command}`, result, 2);
  });
}

test("tester context allows validation command", () => {
  const runId = "self-test";
  mkdirSync(join(ROOT, ".claude", "runs", runId), { recursive: true });
  const result = runHarness(["hook", "pre-bash"], {
    tool_input: { command: "npm run lint" },
  }, {
    HARNESS_AGENT: "tester",
    HARNESS_RUN_ID: runId,
    HARNESS_SELF_TEST_BRANCH: "claude/self-test",
  });
  expectExit("tester context allows validation command", result, 0);
});

for (const file of [
  "src/app/(academy)/academy/actions.ts",
  "src/app/(bus)/bus/actions.ts",
  "src/app/(admin)/admin/actions/lunch-actions.ts",
  "src/lib/supabase/storage.ts",
  "src/lib/bus/state.ts",
  "src/components/ui/button.tsx",
]) {
  test(`docs requirements detected: ${file}`, () => {
    const result = runHarness(["docs", "requirements", file]);
    expectExit(`docs requirements detected: ${file}`, result, 0);
  });
}

test("validate passes current harness", () => {
  const result = runHarness(["validate"]);
  expectExit("validate passes current harness", result, 0);
});

let failed = 0;
for (const { name, fn } of tests) {
  try {
    fn();
    console.log(`[PASS] ${name}`);
  } catch (error) {
    failed += 1;
    console.error(`[FAIL] ${name}`);
    console.error(error.message);
  }
}

if (failed > 0) {
  console.error(`[harness-self-test] ${failed} failed`);
  process.exit(1);
}

console.log(`[harness-self-test] ${tests.length} passed`);
