#!/usr/bin/env node
// PostToolUse hook: Write|Edit 시 문서 동기화 리마인더
// 구조 변경(새 페이지, 액션, 컴포넌트, 타입 등) 감지 → 어떤 MD를 업데이트해야 하는지 알려줌

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

  // .claude/ 내부 파일 수정은 무시 (문서 자체 수정)
  if (filePath.includes('.claude/')) process.exit(0);

  const fileName = filePath.split('/').pop() || '';
  const reminders = [];

  // Server Action 파일 (신규 또는 수정)
  if (filePath.includes('admin/actions/') && filePath.endsWith('.ts') && fileName !== 'actions.ts') {
    reminders.push(`⚠️ [DOC SYNC 필수] Server Action 변경: ${fileName}`);
    reminders.push(`  → .claude/rules/server-actions.md — 함수 추가/수정/삭제 반영`);
    reminders.push(`  → .claude/routes/shared-actions.md — 상세 파라미터/권한/테이블 매핑`);
    reminders.push(`  → src/app/(admin)/admin/actions.ts — barrel re-export 확인`);
  }
  // Barrel re-export
  else if (filePath.endsWith('admin/actions.ts') || filePath.endsWith('academy/actions.ts')) {
    reminders.push(`⚠️ [DOC SYNC] barrel export 변경: ${fileName}`);
    reminders.push(`  → .claude/rules/server-actions.md — 파일 수 갱신`);
  }
  // 새 페이지 (page.tsx)
  else if (fileName === 'page.tsx') {
    reminders.push(`⚠️ [DOC SYNC 필수] 페이지 변경: ${filePath}`);
    reminders.push(`  → .claude/rules/architecture.md — 라우트맵 + 라우트 테이블`);
    reminders.push(`  → .claude/routes/_index.md — 새 라우트면 인덱스에 링크 추가`);
    // 관리자 페이지면 사이드바도
    if (filePath.includes('(admin)')) {
      reminders.push(`  → AdminSidebar.tsx navItems — 새 메뉴 항목 추가 여부`);
    }
  }
  // 레이아웃
  else if (fileName === 'layout.tsx') {
    reminders.push(`⚠️ [DOC SYNC] 레이아웃 변경: ${filePath}`);
    reminders.push(`  → .claude/rules/architecture.md — 레이아웃 구성 확인`);
  }
  // DB 타입
  else if (filePath.includes('src/lib/types/') && filePath.endsWith('.ts')) {
    reminders.push(`⚠️ [DOC SYNC] 타입 변경: ${fileName}`);
    reminders.push(`  → .claude/rules/database.md — 스키마 다이어그램`);
    reminders.push(`  → .claude/routes/shared-lib.md — 타입 목록`);
  }
  // 공유 컴포넌트 (src/components/ 루트)
  else if (filePath.match(/src\/components\//) && filePath.endsWith('.tsx')) {
    reminders.push(`⚠️ [DOC SYNC] 공유 컴포넌트 변경: ${fileName}`);
    reminders.push(`  → .claude/rules/components.md — Shared Components 테이블`);
    reminders.push(`  → .claude/CLAUDE.md — 공통 유틸 섹션 (새 공유 컴포넌트면)`);
  }
  // src/lib/ 유틸
  else if (filePath.includes('src/lib/') && filePath.endsWith('.ts') && !filePath.includes('types/')) {
    reminders.push(`⚠️ [DOC SYNC] 유틸 변경: ${fileName}`);
    reminders.push(`  → .claude/routes/shared-lib.md — 유틸 목록`);
    reminders.push(`  → .claude/rules/core.md — 핵심 원칙 (새 유틸이면)`);
  }
  // teacher-labels
  else if (fileName === 'teacher-labels.ts') {
    reminders.push(`⚠️ [DOC SYNC] 교사 라벨 변경`);
    reminders.push(`  → .claude/rules/patterns.md — Teacher Type 섹션`);
  }
  // DB 스키마 SQL
  else if (filePath.includes('schema/') && filePath.endsWith('.sql')) {
    reminders.push(`⚠️ [DOC SYNC] DB 스키마 변경: ${fileName}`);
    reminders.push(`  → .claude/rules/database.md — 스키마 다이어그램`);
  }

  if (reminders.length > 0) {
    // IMPORTANT 태그로 강조하여 Claude가 무시하지 않도록
    console.log('\n📝 ' + reminders.join('\n'));
    console.log('IMPORTANT: 위 문서를 이 작업 완료 후 반드시 업데이트하세요. 누락 시 다음 세션에서 컨텍스트 불일치가 발생합니다.');
  }

  process.exit(0);
});
