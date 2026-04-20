#!/usr/bin/env node
// PostToolUse hook: apply_migration 완료 후 체크리스트 출력

console.log(`
[MIGRATION COMPLETE] 다음 3가지를 확인하세요:
  1. .claude/rules/database.md       — 스키마 다이어그램 최신화
  2. src/lib/types/database.ts       — DB 타입 갱신 (db-architect 에이전트의 generate_typescript_types 활용)
  3. 관련 .claude/routes/*.md        — 영향받는 페이지의 데이터 흐름 섹션 업데이트
`);

process.exit(0);
