#!/usr/bin/env node
// PostToolUse hook: Write|Edit 시 특정 파일 수정 후 문서 동기화 리마인더 출력
// Server Actions, 타입, 컴포넌트, 페이지 변경 시 어떤 MD 파일을 업데이트해야 하는지 알려줌

const chunks = [];
process.stdin.on('data', (d) => chunks.push(d));
process.stdin.on('end', () => {
  const raw = Buffer.concat(chunks).toString().trim();
  let parsed = {};
  try { parsed = JSON.parse(raw); } catch {}

  const filePath = (
    parsed.tool_input?.file_path ||
    parsed.tool_input?.path ||
    ''
  ).replace(/\\/g, '/');

  if (!filePath) process.exit(0);

  const fileName = filePath.split('/').pop() || '';
  const reminders = [];

  // Server Action 파일
  if (filePath.includes('admin/actions/') && filePath.endsWith('.ts')) {
    reminders.push(`[DOC SYNC] ${fileName} 수정됨`);
    reminders.push(`  → .claude/rules/server-actions.md — 함수 목록 업데이트`);
    reminders.push(`  → .claude/routes/shared-actions.md — 상세 파라미터/반환값 확인`);
  }
  else if (filePath.includes('academy/actions.ts')) {
    reminders.push(`[DOC SYNC] academy/actions.ts 수정됨`);
    reminders.push(`  → .claude/rules/server-actions.md — academy 함수 목록 업데이트`);
    reminders.push(`  → .claude/routes/shared-actions.md — 상세 파라미터/반환값 확인`);
  }
  // DB 타입 파일
  else if (filePath.includes('lib/types/') && filePath.endsWith('.ts')) {
    reminders.push(`[DOC SYNC] ${fileName} 수정됨`);
    reminders.push(`  → .claude/rules/database.md — 타입 정의 섹션 확인`);
    reminders.push(`  → .claude/routes/shared-lib.md — 타입 목록 업데이트`);
  }
  // DB 스키마 파일
  else if (filePath.includes('docs/schema/') && filePath.endsWith('.sql')) {
    reminders.push(`[DOC SYNC] ${fileName} 수정됨`);
    reminders.push(`  → .claude/rules/database.md — 스키마 다이어그램 업데이트`);
  }
  // 공유 컴포넌트
  else if (filePath.includes('/components/') && !filePath.includes('(admin)') && !filePath.includes('(academy)') && !filePath.includes('(site)')) {
    reminders.push(`[DOC SYNC] ${fileName} 수정됨`);
    reminders.push(`  → .claude/rules/components.md — 공유 컴포넌트 목록 확인`);
    reminders.push(`  → .claude/routes/shared-components.md — 컴포넌트 역할 업데이트`);
  }
  // layout.tsx 또는 주요 구조 변경
  else if (fileName === 'layout.tsx' && (filePath.includes('admin/') || filePath.includes('academy/'))) {
    reminders.push(`[DOC SYNC] ${fileName} 수정됨`);
    reminders.push(`  → .claude/rules/architecture.md — 레이아웃 구성 업데이트`);
  }

  if (reminders.length > 0) {
    console.log('\n' + reminders.join('\n'));
  }

  process.exit(0);
});
