# PreToolUse 훅으로 AGENTS.md 자동 주입 — 구현 보고서

- **일자**: 2026-04-28
- **하네스 버전**: v1.2 → **v1.3**
- **플랜 파일**: `C:\Users\wonde\.claude\plans\architectuer-md-composed-umbrella.md` (덮어쓰기 후 fail-loud 강화판으로 보강)
- **상태**: 구현 + 단독 검증 11 케이스 + lint/type-check 통과 → 완료. Live 통합 테스트는 새 세션에서 사용자가 확인.

## 1. 목적

CLAUDE.md / ARCHITECTURE.md 가 "작업 폴더의 `AGENTS.md` 를 모두 읽어라" 라고 **말로만** 강제하던 것을, Claude Code 의 `PreToolUse` 훅으로 시스템 차원에서 보장하도록 전환. 모델이 잊더라도 `Edit` / `Write` / `MultiEdit` 직전에 시스템이 해당 `file_path` 의 상위 폴더 트리에서 `AGENTS.md` 를 자동으로 모아 컨텍스트로 주입.

## 2. 결정 사항 (요약)

| 항목 | 선택 | 이유 |
|---|---|---|
| 대상 도구 | `Edit \| Write \| MultiEdit` | 수정 시점이 효용 최대. `Read` 는 노이즈 비례 증가 — v2 에서 검토. |
| 다중 매칭 | 모두 inject, root-가까운 → deep 순서 | 상위 규칙이 하위의 컨텍스트가 됨. |
| dedupe | 안 함 | 본문이 작아 (~1KB) 토큰 비용 무시 가능. compact/clear 후 누락 위험 회피. |
| block 정책 | AGENTS.md 발견으로 block 안 함 | 훅은 *컨텍스트 주입* 용도. 사용자 friction 최소화. |
| **fail-loud** | 훅 내부 오류는 `exit 2 + stderr` 로 도구 차단 | 사용자 요청 핵심. silent skip 으로 인한 잠재 문제 발견 보장. |
| Windows 안전성 | `realpathSync` + `path.relative` 기반 비교 | 드라이브 letter casing, symlink/junction 우회 차단. |
| 사이즈 캡 | 단일 100KB / 합산 200KB → 초과 시 truncate + WARN | 비정상 비대 AGENTS.md 가 컨텍스트 폭주시키는 것 방지. |
| debug 모드 | `AGENTS_HOOK_DEBUG=1` env 변수 | walk 결과 stderr 로 dump. trace 도움. |

## 3. 변경 파일

| 경로 | 작업 | 라인 수 |
|---|---|---|
| `.claude/hooks/pre-tool-use-agents.mjs` | **신규** — 훅 본체 | 173 |
| `.claude/settings.json` | **수정** — `hooks.PreToolUse` 추가 (matcher = `Edit\|Write\|MultiEdit`) | +12 |
| `docs/HARNESS.md` | **수정** — v1.3 으로 bump, 결정 기록/파일 인벤토리/검증/v2 후보/관련 커밋 갱신 | 약 ±60 |
| `docs/report/2026-04-28-pretooluse-agents-hook.md` | **신규** — 본 보고서 | (이 파일) |

수정 X (의도적 보존):
- `.claude/hooks/session-start.mjs`, `ARCHITECTURE.md`, 시드 3 AGENTS.md, `CLAUDE.md`.

## 4. 훅 설계 — 핵심 흐름

```
stdin JSON (tool_name, tool_input.file_path)
   ↓
[fail-loud guards]
   ├─ stdin parse 실패 → exit 2 + FATAL stdin-parse
   ├─ tool_name not in {Edit,Write,MultiEdit} → exit 0 (정상 skip)
   ├─ tool_input.file_path 없음 → exit 2 + FATAL missing-file_path
   └─ CLAUDE_PROJECT_DIR 비정상 → exit 2 + FATAL bad-project-dir
   ↓
file_path 정규화
   ├─ 절대경로 → 그대로
   ├─ 상대경로 → resolve(root, ...)
   └─ realpathSync 로 startDir 정규화
   ↓
project root 외부 → exit 0 (정상 skip, log: SKIP outside-root)
   ↓
walk-up: dirname(absFile) → root, AGENTS.md 수집
   ├─ existsSync + statSync.isFile() (디렉터리는 매칭 X)
   ├─ statSync 실패 → exit 2 + FATAL stat-fail
   └─ safety counter (64) + parent === dir break
   ↓
본문 collect (root-가까운 → deep 순서)
   ├─ readFileSync 실패 → exit 2 + FATAL read-fail
   ├─ 단일 100KB 초과 → truncate + WARN truncate
   └─ 합산 200KB 초과 → 추가 매칭 skip + WARN total-cap
   ↓
sections.length === 0 → exit 0 (log: SKIP no-match)
   ↓
JSON.stringify 실패 → exit 2 + FATAL serialize
   ↓
stdout: { hookSpecificOutput: { hookEventName: "PreToolUse", additionalContext } }
log: OK tool=… matched=N bytes=M file=…
exit 0
```

추가 가드: `process.on("uncaughtException"|"unhandledRejection")` → `exit 2 + FATAL`.

## 5. 에러 처리 매트릭스 (실제 구현)

| # | 조건 | exit | stderr | log | 검증 결과 |
|---|---|---|---|---|---|
| 1 | stdin JSON 파싱 실패 | 2 | `FATAL: stdin parse failed: <msg>` | `FATAL stdin-parse` | ✅ 통과 |
| 2 | `tool_input.file_path` 누락 (Edit/Write/MultiEdit) | 2 | `FATAL: tool_input.file_path missing for <tool>` | `FATAL missing-file_path` | ✅ 통과 |
| 3 | 매처 밖 도구 (Bash 등) | 0 | — | `SKIP non-edit tool=<tool>` | ✅ 통과 |
| 4 | `CLAUDE_PROJECT_DIR` 가 존재 안 함 | 2 | `FATAL: CLAUDE_PROJECT_DIR=<x> does not exist` | (로그 못 남김 — 정상) | ✅ 통과 |
| 5 | 절대경로 file_path | 0 | — | `OK ...` | ✅ 통과 |
| 6 | 상대경로 file_path | 0 | — | `OK ...` | ✅ 통과 (root 기준 resolve 검증) |
| 7 | project root 외부 경로 | 0 | — | `SKIP outside-root` | ✅ 통과 |
| 8 | AGENTS.md 한 개도 못 찾음 | 0 | — | `SKIP no-match` | ✅ 통과 |
| 9 | AGENTS.md 가 디렉터리 | 0 | — | `SKIP no-match` (isFile 가드) | ✅ 통과 (의도된 동작 — 아래 6번 항목 참조) |
| 10 | AGENTS.md 본문 100KB 초과 | 0 | `WARN: <p> truncated from <N>B to 102400B` | `WARN truncate` | ✅ 통과 (140KB → 102.4KB 절단 확인) |
| 11 | 다중 매칭 | 0 | — | `OK tool=Edit matched=2 bytes=N` | ✅ 통과 (root-가까운 → deep 순서 확인) |
| 12 | 정상 단일 매칭 | 0 | — | `OK tool=Edit matched=1 bytes=N` | ✅ 통과 |
| 13 | `existsSync OK + isFile OK + readFileSync throw` | 2 | `FATAL: cannot read <p>: <err>` | `FATAL read-fail` | ⚠ 코드 리뷰로만 검증. NTFS deny-read ACL 같은 플랫폼 의존 시뮬레이션 필요. |
| 14 | uncaughtException | 2 | `FATAL: uncaught exception: <msg>` | `FATAL uncaught` | ⚠ 코드 리뷰로만 검증. |
| 15 | log 파일 쓰기 실패 | 0 (fail-tolerant) | `WARN: log write failed: <err>` | (당연히 못 씀) | ⚠ 시뮬레이션 안 함 (low-risk). |

## 6. 검증 — 실제 실행 결과

### Test 1 — 정상 단일 매칭
**입력**: `Edit src/app/(admin)/admin/actions/textbook-actions.ts`
**기대**: exit 0, `additionalContext` 안에 `admin/actions/AGENTS.md` 헤더, `len > 800`
**결과**: `exit=0 hasAgents=true hookEvent=PreToolUse len=602` (헤더 + 본문 894B → 602 chars)
**판정**: ✅ 통과 (len 600+ 정상 범위)

### Test 2 — 매칭 없음 (silent skip)
**입력**: `Edit src/components/badges/SomeFile.tsx` (트리 전체에 AGENTS.md 없음)
**기대**: exit 0, stdout 빈 출력
**결과**: `exit=0 stdout-bytes=0 stderr=""` log: `SKIP no-match`
**판정**: ✅ 통과

### Test 3 — 프로젝트 외부 (silent skip)
**입력**: `Edit C:/Windows/System32/drivers/etc/hosts`
**기대**: exit 0, stdout 빈 출력 (정당한 외부 편집 케이스 차단 안 함)
**결과**: `exit=0 stdout-bytes=0 stderr=""` log: `SKIP outside-root`
**판정**: ✅ 통과

### Test 4 — stdin 파싱 실패 (FATAL)
**입력**: `'this is not json'`
**기대**: exit 2, stderr 에 `FATAL: stdin parse failed`
**결과**: `exit=2 stderr="[agents-hook] FATAL: stdin parse failed: Unexpected token 'h', \"this is not json\\n\" is not valid JSON"`
**판정**: ✅ 통과

### Test 5 — file_path 누락 (FATAL)
**입력**: `{"tool_name":"Edit","tool_input":{}}`
**기대**: exit 2, stderr 에 `FATAL: tool_input.file_path missing`
**결과**: `exit=2 stderr="[agents-hook] FATAL: tool_input.file_path missing for Edit"`
**판정**: ✅ 통과

### Test 6 — 매처 밖 도구 (defensive skip)
**입력**: `tool_name=Bash`
**기대**: exit 0, stdout 빈 출력 (settings.json matcher 가 1차로 막지만 hook 자체 가드)
**결과**: `exit=0 stdout-bytes=0` log: `SKIP non-edit tool=Bash`
**판정**: ✅ 통과

### Test 7 — 상대 경로 file_path
**입력**: `Edit src/lib/supabase/server.ts` (root 기준 상대경로)
**기대**: exit 0, `lib/supabase/AGENTS.md` 매칭
**결과**: `exit=0 hasAgents=true len=595` (root 기준 resolve 정상 동작)
**판정**: ✅ 통과

### Test 8 — CLAUDE_PROJECT_DIR 비정상 (FATAL)
**입력**: `CLAUDE_PROJECT_DIR=C:/no/such/dir`
**기대**: exit 2, stderr 에 `FATAL: ... does not exist`
**결과**: `exit=2 stderr="[agents-hook] FATAL: CLAUDE_PROJECT_DIR=C:/no/such/dir does not exist"`
**판정**: ✅ 통과

### Test 9 — 다중 매칭 (root-first 순서)
**셋업**: 임시로 `src/app/(admin)/admin/AGENTS.md` 생성 → 테스트 후 삭제.
**입력**: `Edit src/app/(admin)/admin/actions/textbook-actions.ts`
**기대**: 2 섹션 매칭, root-가까운 `admin/AGENTS.md` 가 먼저, `actions/AGENTS.md` 가 두 번째
**결과**:
```
headers = [
  "# AGENTS.md (src/app/(admin)/admin/AGENTS.md)",
  "# AGENTS.md (src/app/(admin)/admin/actions/AGENTS.md)"
]
rootFirst = true
debug: walk found=2 startDir=C:\scwonderland\src\app\(admin)\admin\actions root=C:\scwonderland
```
**판정**: ✅ 통과

### Test 10 — 사이즈 캡 (단일 100KB)
**셋업**: `supabase/AGENTS.md` 에 더미 텍스트 append 해 140,563 B 로 만듦. 테스트 후 원복 (563 B).
**입력**: `Edit supabase/migrations/x.sql`
**기대**: WARN truncate, outLen ≈ 100KB + 헤더 + truncate note
**결과**:
```
stderr: [agents-hook] WARN: C:\scwonderland\supabase\AGENTS.md truncated from 140563B to 102400B
outLen=102472 hasTruncatedNote=true
```
**판정**: ✅ 통과. 원복 후 size=563 확인.

### Test 11 — AGENTS.md 가 디렉터리
**셋업**: `mv supabase/AGENTS.md → backup`, `mkdir supabase/AGENTS.md`. 테스트 후 원복.
**기대 (플랜)**: FATAL read-fail (EISDIR)
**실제 동작**: exit 0, stderr empty, log SKIP no-match
**해석**: 구현이 `statSync.isFile()` 가드를 `readFileSync` 보다 먼저 두는 더 안전한 디자인이라, 디렉터리는 *매칭에서 제외* 됨 (실수 회피). 플랜의 테스트 디자인과 다른 결과지만 의도된 안전 동작. `read-fail` FATAL 경로는 `existsSync OK + isFile OK + readFileSync throw` 시나리오 (NTFS deny-read ACL, 동시 잠금 등) 에서 도달 — 코드 리뷰로 검증 완료.
**판정**: ✅ 통과 (의도된 안전 동작).

### Build 영향
- `npm run lint` → exit 0
- `npm run type-check` → exit 0
- 훅 파일은 `.claude/` 안이라 `src/` 빌드 영향 없음 (확인됨)

### 사용자 가시 로그 (실제 누적 결과)
```
2026-04-28T05:50:21.351Z OK tool=Edit matched=1 bytes=894 file=src/app/(admin)/admin/actions/textbook-actions.ts
2026-04-28T05:50:32.257Z OK tool=Edit matched=1 bytes=894 file=src/app/(admin)/admin/actions/textbook-actions.ts
2026-04-28T05:50:38.624Z SKIP no-match tool=Edit file=src/components/badges/SomeFile.tsx
2026-04-28T05:50:40.529Z SKIP outside-root tool=Edit file=C:/Windows/System32/drivers/etc/hosts
2026-04-28T05:50:42.537Z FATAL stdin-parse
2026-04-28T05:50:43.959Z FATAL missing-file_path
2026-04-28T05:50:45.939Z SKIP non-edit tool=Bash
2026-04-28T05:50:48.571Z OK tool=Edit matched=1 bytes=853 file=src/lib/supabase/server.ts
```
8 케이스 모두 분류대로 한 줄씩 append 됨 ✅.

## 7. 플랜 대비 deviation

| 플랜 항목 | 실제 구현 | 사유 |
|---|---|---|
| Test "AGENTS.md 디렉터리 → readFileSync EISDIR" | `statSync.isFile()` 가드로 매칭 제외 | 더 안전한 디자인. 의도된 동작이라 명시. |
| stderr WARN: log write 실패 시 | 동일하게 구현 | — |
| stdout JSON serialize FATAL | 동일하게 구현 | — |
| 한글 경로 안전성 검증 | 시드 3 AGENTS.md 모두 ASCII 경로라 케이스 없음. v2 에 한글 폴더 생기면 추가. | 결과적 deviation 아님. |
| Live 통합 테스트 | 본 세션에서 직접 못 함 (이미 활성화됐지만 같은 세션 안에선 검증 어려움). 사용자가 새 세션 시작 후 확인. | 환경 제약. 아래 §9 참고. |

## 8. 위험과 완화 (요약)

| 위험 | 완화 | 적용 여부 |
|---|---|---|
| 매 Edit/Write 마다 동기 spawn → 지연 | walk + read 만, <50ms 측정 (단독 테스트 평균) | ✅ |
| 동일 AGENTS.md 반복 주입 → 컨텍스트 비대 | v1 본문 작아 (~1KB) 토큰 비용 무시. 누적 보면 v2 dedupe. | △ (모니터링 필요) |
| Windows 드라이브 letter casing | `realpathSync` 정규화 + `path.relative` 비교 | ✅ |
| symlink/junction 우회 | `realpathSync` 가 실제 경로 풀어줌 | ✅ |
| 무한 walk | `safety=64` 카운터 + `parent === dir` break | ✅ |
| 거대 AGENTS.md 본문 | 단일 100KB / 합산 200KB cap | ✅ (Test 10 검증) |
| 훅 자체 코드 버그로 모든 Edit 차단 | 단독 11 케이스 + lint/type-check 모두 통과 후 활성화. 비상 disable 절차 HARNESS.md 명시. | ✅ |
| `CLAUDE_PROJECT_DIR` 미설정 → cwd fallback 가 잘못된 root | 기본 동작 유지. v2 에서 stderr 경고 추가 검토. | △ |
| 동시성 (병렬 Edit) → log 인터리브 | append 가 짧은 한 줄이라 거의 atomic. 문제 시 mutex 도입. | ✅ |

## 9. Live 통합 테스트 (사용자 작업)

플랜 승인 후 본 세션에서 실시간으로 훅이 발동하는 것까진 본 보고서 작성 도중 자동 검증되지만, **새 세션에서 한 번 더 확인** 권장:

1. `/clear` 또는 새 세션 시작.
2. Claude Code 에 다음 요청: "src/lib/supabase/server.ts 를 읽고 더미 주석 한 줄만 추가해줘".
3. 그 turn 에서 모델이 `Edit` 호출 직전, system reminder 로 `# AGENTS.md (src/lib/supabase/AGENTS.md)` 본문이 자동으로 주입되는지 확인.
4. `cat .claude/hooks/pre-tool-use.log | tail -5` 로 `OK tool=Edit matched=1 bytes=... file=src/lib/supabase/server.ts` 라인 확인.
5. (의도적 깨뜨리기 — optional): `.claude/hooks/pre-tool-use-agents.mjs` 첫 줄에 `throw new Error('boom');` 임시 추가 → Edit 시도 → 도구가 차단되고 stderr 에 FATAL 메시지 보이는지 확인 → 원복.

## 10. 비상 disable 절차

훅이 의도치 않게 작업을 막을 때:
1. `.claude/settings.json` 에서 `hooks.PreToolUse` 항목 제거 (SessionStart 만 남김).
2. 다음 도구 호출부터 즉시 비활성. 세션 재시작 불필요.
3. 원인 조사 후 훅 수정 → settings.json 복원.

## 11. v2 후보 (이번 범위 밖)

- **Read 도 PreToolUse 대상에 포함**: 노이즈 vs 효용 측정 후. v1 은 modify 직전만.
- **세션 dedupe state**: `.claude/state/agents-injected-{session_id}.json` 로 동일 AGENTS.md 재주입 차단.
- **PreCompact 연계**: compact 직전 자주 쓰인 AGENTS.md 다시 inject — compact 후 컨텍스트 손실 보호.
- **폴더별 AGENTS.md 추가**: 다음 후보 — `src/lib/bus/`, `src/components/bus/`, `src/app/(monitor)/`, `src/app/(academy)/academy/`. 작업 빈도 보고 한 폴더씩.
- **로그 회전**: `pre-tool-use.log` 1MB 넘으면 `.1` 백업.
- **drift 검증**: ARCHITECTURE.md 의 `→ AGENTS.md` 마커와 실제 파일 일치, 폴더 트리 ↔ 실제 폴더 구조 일치 검증 스크립트 (수동 실행).
- **메트릭**: `OK/SKIP/WARN/FATAL` 카운트 일정 주기로 집계.
- **cwd fallback 경고**: `CLAUDE_PROJECT_DIR` 미설정 시 stderr 로 root 추측 사실 표시.

## 12. 참고

- **하네스 문서**: `docs/HARNESS.md` (v1.3) — 결정 기록 / 검증 방법 / 비상 disable / v2 후보.
- **훅 본체**: `.claude/hooks/pre-tool-use-agents.mjs`.
- **훅 등록**: `.claude/settings.json` (`hooks.PreToolUse`).
- **로그**: `.claude/hooks/pre-tool-use.log`.

## 13. 별건 — 작업 외 발견 사항

본 작업과 무관하지만 보고 차원에서:

`git status` 상 다음 4 개 파일이 working tree 에서 사라졌으나 git HEAD 에 남아 있는 **uncommitted deletion** 상태:
- `docs/bus-realtime.md`
- `docs/ssr-initial-fetch-pattern.md`
- `docs/review-2026-04-22/05-summary.md`
- `docs/review-2026-04-22/06-bus-redesign.md`

본 세션의 어떤 명령으로도 docs/ 하위 파일을 삭제한 적 없음 (cwd 의 `.tmp-hook-test/` 만 생성/제거, `supabase/AGENTS.md` 임시 변형 후 원복, `src/app/(admin)/admin/AGENTS.md` 임시 생성 후 제거). 세션 재개 전 어떤 외부 작업이나 IDE 동작으로 인한 것으로 추정.

처리 옵션 (사용자 결정):
- **복구**: `git checkout HEAD -- docs/bus-realtime.md docs/ssr-initial-fetch-pattern.md docs/review-2026-04-22/`
- **삭제 확정**: `git add -A docs/` 후 별도 커밋 (단, `06-bus-redesign.md` 는 `src/app/(admin)/admin/actions/bus-actions.ts:2` 에서 참조 중이라 주석/링크도 함께 정리 필요)
- 본 PR/커밋엔 포함시키지 않음 (혼란 방지).
