#!/usr/bin/env node
// PreToolUse hook: Read|Edit|Write 시 파일 경로를 보고 관련 routes/*.md 자동 주입
// Claude Code가 파일 작업 전에 해당 라우트 문서를 컨텍스트로 받아볼 수 있게 함

const fs = require('fs');
const path = require('path');

const ROUTES_DIR = path.join(__dirname, '..', 'routes');

// 경로 패턴 → routes/*.md 매핑 (앞쪽 패턴이 더 구체적인 것 먼저)
const ROUTE_MAP = [
  // Academy
  ['academy/student',          'academy-student.md'],
  ['academy/teacher',          'academy-teacher.md'],
  ['academy/login',            'academy-login.md'],
  // Admin
  ['admin/students',           'admin-students.md'],
  ['admin/teachers',           'admin-teachers.md'],
  ['admin/classes',            'admin-classes.md'],
  ['admin/textbooks',          'admin-textbooks.md'],
  ['admin/academy-notices',    'admin-academy-notices.md'],
  ['admin/notices',            'admin-notices.md'],
  ['admin/timetable',          'admin-timetable.md'],
  ['admin/afterschool',        'admin-afterschool.md'],
  ['admin/reports',            'REPORT.md'],
  ['admin/bus',                'admin-bus.md'],
  ['admin/dashboard',          'admin-dashboard.md'],
  // Shared actions
  ['admin/actions',            'shared-actions.md'],
  ['academy/actions',          'shared-actions.md'],
  // Shared src/lib/ and src/components/
  ['src/lib/types',            'shared-lib.md'],
  ['src/lib/supabase',         'shared-lib.md'],
  ['src/components/',          'shared-components.md'],
  // Bus / Monitor
  ['(bus)',                    'bus-staff.md'],
  ['(monitor)',                'bus-monitor.md'],
  // Site
  ['about-wonderland',         'site-about.md'],
  ['program',                  'site-program.md'],
  ['(site)/notice',            'site-notice.md'],
  ['community',                'site-community.md'],
  ['experience',               'site-experience.md'],
];

const chunks = [];
process.stdin.on('data', (d) => chunks.push(d));
process.stdin.on('end', () => {
  const raw = Buffer.concat(chunks).toString().trim();
  let parsed = {};
  try { parsed = JSON.parse(raw); } catch {}

  // 파일 경로 추출 (Read, Edit, Write 공통)
  const filePath = (
    parsed.tool_input?.file_path ||
    parsed.tool_input?.path ||
    ''
  ).replace(/\\/g, '/');

  if (!filePath) process.exit(0);

  // 패턴 매칭
  let matched = null;
  for (const [pattern, mdFile] of ROUTE_MAP) {
    if (filePath.includes(pattern)) {
      matched = mdFile;
      break;
    }
  }

  if (!matched) process.exit(0);

  const mdPath = path.join(ROUTES_DIR, matched);
  if (!fs.existsSync(mdPath)) process.exit(0);

  try {
    const content = fs.readFileSync(mdPath, 'utf8');
    console.log(`\n[ROUTE CONTEXT: ${matched}]\n${content}`);
  } catch {}

  process.exit(0);
});
