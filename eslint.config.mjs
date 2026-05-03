import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    // git worktrees 안의 빌드 산출물까지 lint 되는 문제 차단
    ".worktrees/**",
    "**/.next/**",
    "**/node_modules/**",
    "supabase/.temp/**",
    "supabase/.branches/**",
    // OMC 세션 산출물 (리서치 덤프, 상태 파일)
    ".omc/**",
  ]),
  // _ 접두사 미사용 변수 허용 (TS 컨벤션 — 의도된 unused)
  {
    rules: {
      "@typescript-eslint/no-unused-vars": [
        "warn",
        {
          argsIgnorePattern: "^_",
          varsIgnorePattern: "^_",
          caughtErrorsIgnorePattern: "^_",
          destructuredArrayIgnorePattern: "^_",
        },
      ],
    },
  },
]);

export default eslintConfig;
