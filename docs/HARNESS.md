# SC Wonderland Harness

이 프로젝트의 Claude Code 협업 도구(하네스). **하네스 관련 작업** — 훅 추가/수정, 세션 컨텍스트 변경, `ARCHITECTURE.md` 구조 갱신, `.claude/settings.json` 수정 — 을 하기 전에 이 문서를 읽는다.

## 현재 상태 (v1.3, 2026-04-28)

- **훅 2개**:
  - `SessionStart` (`.claude/hooks/session-start.mjs`) — ARCHITECTURE.md 본문을 system prompt 에 주입.
  - `PreToolUse` (`.claude/hooks/pre-tool-use-agents.mjs`) — Edit/Write/MultiEdit 직전, file_path 의 상위 폴더 트리에서 `AGENTS.md` 를 모두 모아 `additionalContext` 로 주입. **fail-loud**: 훅 내부 오류 (stdin 깨짐, AGENTS.md 읽기 실패 등) 는 `exit 2 + stderr` 로 도구를 차단.
- **루트 마크다운 2개**: `CLAUDE.md` (Claude Code 자동 로드), `ARCHITECTURE.md` (훅으로 주입).
- **AGENTS.md (도메인 가이드) 3개**: `src/app/(admin)/admin/actions/`, `src/lib/supabase/`, `supabase/`. PreToolUse 훅이 자동 inject.
- **훅 등록**: `.claude/settings.json` — `hooks.SessionStart` (matcher 없음) + `hooks.PreToolUse` (matcher = `Edit|Write|MultiEdit`).
- **로그**: 두 훅 모두 `.claude/hooks/<name>.log` 에 한 줄 append. `cat` 으로 직접 동작 검증 가능.

## 원칙

1. **무거운 자동화 금지** — worker/tester/docs-auditor 같은 subagent 강제, manifest 자동 생성, pre-commit gate 등은 모두 제거됨. 다시 도입하기 전에 진짜 필요한지 검증.
2. **점진 추가** — 폴더별 `AGENTS.md`, PreToolUse 훅, drift 검증 등은 필요해질 때 한 폴더/한 기능씩.
3. **출력 일관성** — 훅은 항상 stdout 마지막에 단일 JSON 한 번만. 디버그 출력은 파일 로그 + (필요시) stderr.
4. **fail-loud / fail-closed** — 훅 내부 오류는 silent 무시 X. SessionStart 는 누락 케이스에 경고 컨텍스트로 끝내지만, PreToolUse 는 stdin/AGENTS.md IO 실패 시 `exit 2 + stderr` 로 도구를 차단해 사용자가 알게 한다. silent skip 은 "AGENTS.md 가 없는 게 정상" 인 케이스로만 한정 (project 외부 경로, 매칭 0개, 매처 밖 도구).

## 파일 인벤토리

| 파일 | 역할 | 누가 읽는가 |
|---|---|---|
| `CLAUDE.md` | 프로젝트 작업 규칙 (auth, 마이그레이션, 명령어) | Claude Code 가 매 세션 자동 로드 |
| `ARCHITECTURE.md` | 프로젝트 폴더 구조 + 폴더별 docs 매핑 표 | SessionStart 훅이 주입 |
| `.claude/hooks/session-start.mjs` | ARCHITECTURE.md 를 읽어 hookSpecificOutput.additionalContext 로 출력 | Claude Code 가 SessionStart 시 spawn |
| `.claude/hooks/session-start.log` | SessionStart 훅 실행 흔적 (timestamp + OK/MISSING) | 사용자가 `cat` 으로 |
| `.claude/hooks/pre-tool-use-agents.mjs` | Edit/Write/MultiEdit 의 file_path 상위 트리에서 AGENTS.md 를 walk-up 으로 모아 inject | Claude Code 가 PreToolUse 시 spawn |
| `.claude/hooks/pre-tool-use.log` | PreToolUse 훅 실행 흔적 (OK/SKIP/WARN/FATAL + tool/file/matched) | 사용자가 `cat` 으로 |
| `.claude/settings.json` | SessionStart + PreToolUse 훅 등록 | Claude Code |
| `<folder>/AGENTS.md` | 폴더별 작업 규칙 (수정 직전에 PreToolUse 훅이 자동 주입) | Claude Code 가 PreToolUse 시 / 사람이 직접 |
| `docs/HARNESS.md` | 하네스 자체에 대한 문서 (이 파일) | 사람 + 새 세션 시작한 모델 |

## 결정 기록

### 이전 무거운 하네스를 통째로 제거 (`70b73eb`)
`HARNESS_MANIFEST.json` + `STRUCTURE.md` 자동 생성, worker/tester/docs-auditor 강제, route/rule docs, pre-commit gate 등이 있었으나, (a) 자동화 비용 > 효용, (b) 검증 실패가 작업 차단을 너무 자주 일으킴, (c) 하네스 자체 유지보수가 부담. 새 출발선으로 리셋.

### CLAUDE.md 를 훅에서 안 다룬다 (v1 → v1.1, `7fee4d1`)
Claude Code 가 `<project>/CLAUDE.md` 를 자동 로드하므로 훅이 또 주입하면 같은 본문이 두 번 들어가서 토큰 낭비. 훅은 ARCHITECTURE.md 만 담당. CLAUDE.md 갱신은 Claude Code 의 자동 로드 라인에 맡김.

### matcher 안 씀
`SessionStart` 매처 없이 등록 → startup/resume/clear/compact 모두에서 발동. ARCHITECTURE.md 주입은 어떤 source 든 동일하게 필요하므로 분기 무의미. 향후 source 별로 다른 컨텍스트가 필요해지면 그때 매처 추가.

### 폴더별 AGENTS.md 자동 주입 (PreToolUse) 채택 (v1.2 → v1.3)
CLAUDE.md 의 "AGENTS.md 모두 읽기" 규칙을 훅으로 강제. Edit/Write/MultiEdit 직전에 `file_path` 의 상위 폴더 트리에서 `AGENTS.md` 를 모아 `additionalContext` 로 inject — 모델이 잊어도 시스템이 빠뜨리지 않게 보장.

설계 결정:
- **대상 도구**: `Edit | Write | MultiEdit`. `Read` 는 v1 제외 (노이즈/효용 비).
- **여러 매칭 시 모두 inject**, root 가까운 것 → deep 한 것 순서. 상위 규칙이 하위의 컨텍스트가 됨.
- **dedupe 없음**. 본문이 작아 토큰 비용 무시 가능. compact/clear 후 누락 위험 회피.
- **fail-loud**: stdin 깨짐, AGENTS.md 읽기 실패, `CLAUDE_PROJECT_DIR` 비정상, JSON 직렬화 실패, uncaught 예외 등은 `exit 2 + stderr` 로 도구를 차단. silent skip 은 "AGENTS.md 가 없는 게 정상" 케이스만.
- **Windows 안전성**: `realpathSync` 로 드라이브 letter casing/symlink 정규화. `path.relative` 기반 `isInsideOrEqual()` 로 root 비교.
- **사이즈 캡**: 단일 100KB / 합산 200KB. 초과 시 truncate + WARN (차단까진 아님).
- **debug 모드**: 환경변수 `AGENTS_HOOK_DEBUG=1` 로 walk 결과 stderr dump.

### 비상 disable 절차 (PreToolUse)
훅이 의도치 않게 작업을 막을 때:
1. `.claude/settings.json` 에서 `hooks.PreToolUse` 항목 통째 제거 (SessionStart 만 남기기).
2. 다음 도구 호출부터 즉시 비활성. 세션 재시작 불필요.
3. 원인 조사 후 훅 수정 → settings.json 복원.

### ARCHITECTURE.md 를 엄브렐러로 축약 (v1.1 → v1.2)
ARCHITECTURE.md 가 트리 + 규칙 + 환경 + 명령어를 한 파일에 다 담아 49줄로 비대해지고 있었음. 거기에다 CLAUDE.md 와 명령어/환경 규칙이 중복. 결정: ARCHITECTURE.md 는 **폴더 트리 + 한 줄 코멘트**만. 디테일은 도메인 폴더의 `AGENTS.md` 로 위임. 동시에 첫 시드 3개 작성 — `src/app/(admin)/admin/actions/AGENTS.md` (서버 액션 인증), `src/lib/supabase/AGENTS.md` (3 클라이언트 사용 분기), `supabase/AGENTS.md` (마이그레이션 흐름) — 빈 placeholder 표 대신 살아있는 예시에서 출발. 훅은 그대로 (ARCHITECTURE.md 본문만 읽음). 파일명은 `AGENTS.md` 유지 — Codex/Cursor 등 다른 에이전트도 인식하는 사실상 표준이고, Claude Code subagent 정의 (`.claude/agents/<name>.md`) 와 위치·의미 모두 다름.

### `.githooks/pre-commit` 및 `prepare` 스크립트 제거
이전 하네스가 게이팅 용도로 썼으나 새 흐름에선 강제 검증 자체가 없음. `npm install` 시 자동으로 `core.hooksPath` 가 박히는 것도 위험 → `prepare` 도 같이 제거.

## 검증 방법

### SessionStart 훅 단독 테스트
```bash
cd C:/scwonderland
node .claude/hooks/session-start.mjs | node -e "const j=JSON.parse(require('fs').readFileSync(0,'utf8')); const c=j.hookSpecificOutput.additionalContext; console.log('hasArch=', c.includes('# ARCHITECTURE.md'), 'len=', c.length)"
```
기대: `hasArch=true len>500`.

ARCHITECTURE.md 를 임시 rename → stdout 이 `⚠️ ARCHITECTURE.md not found at ...` 로 시작 + log 에 `MISSING path=...` append.

### PreToolUse 훅 단독 테스트 (정상 매칭)
```bash
echo '{"tool_name":"Edit","tool_input":{"file_path":"C:/scwonderland/src/app/(admin)/admin/actions/textbook-actions.ts"}}' | CLAUDE_PROJECT_DIR=C:/scwonderland node .claude/hooks/pre-tool-use-agents.mjs | node -e "const j=JSON.parse(require('fs').readFileSync(0,'utf8')); const c=j.hookSpecificOutput.additionalContext; console.log('hasAgents=', c.includes('admin/actions/AGENTS.md'), 'len=', c.length)"
```
기대: `hasAgents=true len>800`, exit 0.

### PreToolUse 훅 fail-loud 케이스
- **stdin 깨짐** (exit 2): `echo 'not json' | CLAUDE_PROJECT_DIR=C:/scwonderland node .claude/hooks/pre-tool-use-agents.mjs` → stderr `[agents-hook] FATAL: stdin parse failed: ...`.
- **file_path 누락** (exit 2): `echo '{"tool_name":"Edit","tool_input":{}}' | ...` → stderr `[agents-hook] FATAL: tool_input.file_path missing for Edit`.
- **CLAUDE_PROJECT_DIR 비정상** (exit 2): `CLAUDE_PROJECT_DIR=C:/no/such/dir echo '{...}' | ...` → stderr `[agents-hook] FATAL: ... does not exist`.

### PreToolUse 훅 정상 skip 케이스 (exit 0, 빈 stdout)
- **매칭 없음**: `src/components/badges/` 등 AGENTS.md 트리에 없는 경로.
- **프로젝트 외부**: `C:/Windows/...` 같은 경로.
- **매처 밖 도구**: `tool_name=Bash` 등.

### 사용자 가시 로그
```bash
cat C:/scwonderland/.claude/hooks/session-start.log | tail -3
cat C:/scwonderland/.claude/hooks/pre-tool-use.log | tail -10
```
- `session-start.log`: 새 세션마다 `2026-... OK bytes=N` 한 줄.
- `pre-tool-use.log`: 매 Edit/Write/MultiEdit 마다 `OK tool=... matched=N bytes=M file=...` 또는 `SKIP <reason>` / `FATAL <code>` / `WARN <code>` 한 줄.

### 빌드 영향
`npm run lint`, `npm run type-check` 둘 다 exit 0. 하네스 파일은 전부 `src/` 밖이라 영향 없음.

## v2 후보 (이번 범위 아님)

- **Read 도 PreToolUse 대상에 포함**: 노이즈 vs 효용 측정 후. v1 은 modify 직전만.
- **세션 dedupe state**: `.claude/state/agents-injected-{session_id}.json` 로 동일 AGENTS.md 재주입 차단. 토큰 비용 누적이 보일 때.
- **PreCompact 연계**: compact 직전 자주 쓰인 AGENTS.md 다시 inject — compact 후 컨텍스트 손실 보호.
- **폴더별 AGENTS.md 추가**: 첫 3개 (`(admin)/admin/actions/`, `lib/supabase/`, `supabase/`) 시드 완료 (v1.2). 다음 후보 — `src/lib/bus/`, `src/components/bus/`, `src/app/(monitor)/`, `src/app/academy/`. 작업 빈도 보고 한 폴더씩 추가.
- **로그 회전**: `session-start.log` / `pre-tool-use.log` 1MB 넘으면 `.1` 로 백업.
- **drift 검증**: ARCHITECTURE.md 의 `→ AGENTS.md` 마커와 실제 파일 일치, 폴더 트리와 실제 폴더 구조 일치 여부 경고하는 검증 스크립트 (수동 실행).
- **세션 source 별 다른 컨텍스트**: 예 — startup 일 때만 환영 메시지, resume 일 때 최근 commit 요약 등.
- **메트릭**: `pre-tool-use.log` 의 `OK/SKIP/WARN/FATAL` 카운트를 일정 주기로 집계.
- **cwd fallback 경고**: `CLAUDE_PROJECT_DIR` 미설정 시 stderr 로 root 추측 사실 표시.

## 관련 커밋

- `70b73eb chore: remove personal Claude harness` — 이전 무거운 하네스 통째 제거.
- `572ca62 feat: harness v1 — SessionStart hook + ARCHITECTURE.md` — v1 (CLAUDE.md + ARCHITECTURE.md 둘 다 주입).
- `7fee4d1 refactor(hook): drop CLAUDE.md duplicate, add missing-arch warning + run log` — v1.1.
- `3c7c29e docs: add HARNESS.md` — 하네스 자체 문서화.
- `1e4f47b docs: ARCHITECTURE.md 엄브렐러 축약 + AGENTS.md 시드 3개` — v1.2.
- `06181e2 chore: docs/ 정리` — 보류 가이드 + 일회성 리뷰 스냅샷 제거.

## 외부 참고

- Notion: SooChanOh > Study > Claude Code > "SessionStart Hook 동작 원리" / "Resume 와 Context 모델" — 훅 동작 원리 자세히. 코드 외부 학습 자료.
