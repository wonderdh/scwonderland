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
    // understand-anything 도구 산출물 (임시 스크립트, 휴지통)
    ".understand-anything/**",
    // 비활성화된 라우트 보관소 (구 마케팅 사이트 등)
    "archive/**",
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
