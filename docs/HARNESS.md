# SC Wonderland Harness

이 프로젝트의 Claude Code 협업 도구(하네스). **하네스 관련 작업** — 훅 추가/수정, 세션 컨텍스트 변경, `ARCHITECTURE.md` 구조 갱신, `.claude/settings.json` 수정 — 을 하기 전에 이 문서를 읽는다.

## 현재 상태 (v1.2, 2026-04-28)

- **SessionStart 훅 1개**: `.claude/hooks/session-start.mjs`. ARCHITECTURE.md 본문을 system prompt 에 주입.
- **루트 마크다운 2개**: `CLAUDE.md` (Claude Code 자동 로드), `ARCHITECTURE.md` (훅으로 주입).
- **훅 등록**: `.claude/settings.json` 의 `hooks.SessionStart`. matcher 없음 → startup/resume/clear/compact 모두에서 발동.
- **로그**: 매 훅 실행마다 `.claude/hooks/session-start.log` 에 한 줄 append. 사용자가 `cat` 으로 직접 동작 검증 가능.

## 원칙

1. **무거운 자동화 금지** — worker/tester/docs-auditor 같은 subagent 강제, manifest 자동 생성, pre-commit gate 등은 모두 제거됨. 다시 도입하기 전에 진짜 필요한지 검증.
2. **점진 추가** — 폴더별 `AGENTS.md`, PreToolUse 훅, drift 검증 등은 필요해질 때 한 폴더/한 기능씩.
3. **출력 일관성** — 훅은 항상 stdout 마지막에 단일 JSON 한 번만. 디버그 출력은 파일 로그로.
4. **fallback 안전성** — `CLAUDE_PROJECT_DIR` 미설정, 파일 부재 같은 케이스에서 훅이 죽지 않고 경고 컨텍스트 + 로그로 끝낸다.

## 파일 인벤토리

| 파일 | 역할 | 누가 읽는가 |
|---|---|---|
| `CLAUDE.md` | 프로젝트 작업 규칙 (auth, 마이그레이션, 명령어) | Claude Code 가 매 세션 자동 로드 |
| `ARCHITECTURE.md` | 프로젝트 폴더 구조 + 폴더별 docs 매핑 표 | SessionStart 훅이 주입 |
| `.claude/hooks/session-start.mjs` | ARCHITECTURE.md 를 읽어 hookSpecificOutput.additionalContext 로 출력 | Claude Code 가 SessionStart 시 spawn |
| `.claude/hooks/session-start.log` | 훅 실행 흔적 (timestamp + OK/MISSING) | 사용자가 `cat` 으로 |
| `.claude/settings.json` | SessionStart 훅 등록 | Claude Code |
| `docs/HARNESS.md` | 하네스 자체에 대한 문서 (이 파일) | 사람 + 새 세션 시작한 모델 |

## 결정 기록

### 이전 무거운 하네스를 통째로 제거 (`70b73eb`)
`HARNESS_MANIFEST.json` + `STRUCTURE.md` 자동 생성, worker/tester/docs-auditor 강제, route/rule docs, pre-commit gate 등이 있었으나, (a) 자동화 비용 > 효용, (b) 검증 실패가 작업 차단을 너무 자주 일으킴, (c) 하네스 자체 유지보수가 부담. 새 출발선으로 리셋.

### CLAUDE.md 를 훅에서 안 다룬다 (v1 → v1.1, `7fee4d1`)
Claude Code 가 `<project>/CLAUDE.md` 를 자동 로드하므로 훅이 또 주입하면 같은 본문이 두 번 들어가서 토큰 낭비. 훅은 ARCHITECTURE.md 만 담당. CLAUDE.md 갱신은 Claude Code 의 자동 로드 라인에 맡김.

### matcher 안 씀
`SessionStart` 매처 없이 등록 → startup/resume/clear/compact 모두에서 발동. ARCHITECTURE.md 주입은 어떤 source 든 동일하게 필요하므로 분기 무의미. 향후 source 별로 다른 컨텍스트가 필요해지면 그때 매처 추가.

### 폴더별 AGENTS.md 자동 주입 (PreToolUse) 보류
v1 시점엔 폴더별 `AGENTS.md` 가 0개라 PreToolUse 훅이 할 일이 없음. 폴더에 실제 가이드가 쌓이면 그때 PreToolUse 로 자동 주입(v2). 그 전엔 CLAUDE.md 의 "수정 폴더에 AGENTS.md 있으면 모두 읽어" 규칙으로 모델에게 위임.

### ARCHITECTURE.md 를 엄브렐러로 축약 (v1.1 → v1.2)
ARCHITECTURE.md 가 트리 + 규칙 + 환경 + 명령어를 한 파일에 다 담아 49줄로 비대해지고 있었음. 거기에다 CLAUDE.md 와 명령어/환경 규칙이 중복. 결정: ARCHITECTURE.md 는 **폴더 트리 + 한 줄 코멘트**만. 디테일은 도메인 폴더의 `AGENTS.md` 로 위임. 동시에 첫 시드 3개 작성 — `src/app/(admin)/admin/actions/AGENTS.md` (서버 액션 인증), `src/lib/supabase/AGENTS.md` (3 클라이언트 사용 분기), `supabase/AGENTS.md` (마이그레이션 흐름) — 빈 placeholder 표 대신 살아있는 예시에서 출발. 훅은 그대로 (ARCHITECTURE.md 본문만 읽음). 파일명은 `AGENTS.md` 유지 — Codex/Cursor 등 다른 에이전트도 인식하는 사실상 표준이고, Claude Code subagent 정의 (`.claude/agents/<name>.md`) 와 위치·의미 모두 다름.

### `.githooks/pre-commit` 및 `prepare` 스크립트 제거
이전 하네스가 게이팅 용도로 썼으나 새 흐름에선 강제 검증 자체가 없음. `npm install` 시 자동으로 `core.hooksPath` 가 박히는 것도 위험 → `prepare` 도 같이 제거.

## 검증 방법

### 훅 단독 테스트
```bash
cd C:/scwonderland
node .claude/hooks/session-start.mjs | node -e "const j=JSON.parse(require('fs').readFileSync(0,'utf8')); const c=j.hookSpecificOutput.additionalContext; console.log('hasArch=', c.includes('# ARCHITECTURE.md'), 'len=', c.length)"
```
기대: `hasArch=true len>500`.

### 누락 케이스
ARCHITECTURE.md 를 임시 rename → stdout 이 `⚠️ ARCHITECTURE.md not found at ...` 로 시작 + log 에 `MISSING path=...` append.

### 사용자 가시 로그
```bash
cat C:/scwonderland/.claude/hooks/session-start.log | tail -3
```
새 세션마다 `2026-... OK bytes=N` 한 줄씩 늘어야 정상.

### 빌드 영향
`npm run lint`, `npm run type-check` 둘 다 exit 0. 하네스 파일은 전부 `src/` 밖이라 영향 없음.

## v2 후보 (이번 범위 아님)

- **PreToolUse 폴더 컨텍스트 주입**: Edit/Write 대상 경로의 폴더 트리에서 `AGENTS.md` 모아 additionalContext 로 inject.
- **폴더별 AGENTS.md 추가**: 첫 3개 (`(admin)/admin/actions/`, `lib/supabase/`, `supabase/`) 시드 완료 (v1.2). 다음 후보 — `src/lib/bus/`, `src/components/bus/`, `src/app/(monitor)/`, `src/app/(academy)/academy/`. 작업 빈도 보고 한 폴더씩 추가.
- **로그 회전**: `session-start.log` 1MB 넘으면 `.1` 으로 백업.
- **drift 검증**: ARCHITECTURE.md 가 실제 폴더 구조와 어긋나면 경고하는 검증 스크립트 (수동 실행).
- **세션 source 별 다른 컨텍스트**: 예 — startup 일 때만 환영 메시지, resume 일 때 최근 commit 요약 등.

## 관련 커밋

- `70b73eb chore: remove personal Claude harness` — 이전 무거운 하네스 통째 제거.
- `572ca62 feat: harness v1 — SessionStart hook + ARCHITECTURE.md` — v1 (CLAUDE.md + ARCHITECTURE.md 둘 다 주입).
- `7fee4d1 refactor(hook): drop CLAUDE.md duplicate, add missing-arch warning + run log` — v1.1.

## 외부 참고

- Notion: SooChanOh > Study > Claude Code > "SessionStart Hook 동작 원리" / "Resume 와 Context 모델" — 훅 동작 원리 자세히. 코드 외부 학습 자료.
