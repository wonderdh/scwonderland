# 옵저버빌리티 하네스 v2 — 설계 (clean slate)

- 작성일: 2026-06-01
- 상태: 설계 승인 대기
- 출처 시스템: [claude-code-hooks-multi-agent-observability](https://github.com/disler/claude-code-hooks-multi-agent-observability)

## 1. 목표 & 범위

Claude Code 세션 이벤트를 **실시간 대시보드**로 관찰한다. 기존 하네스를 통째로 제거하고
옵저버빌리티만 얹은 깨끗한 v2 로 다시 시작한다.

- **포함**: 이벤트 전송 훅(`send_event.py`) + Bun 서버 + Vue 대시보드.
- **제외 (YAGNI)**: LLM summary(`--summarize`), TTS 음성, 위험명령 차단 보안 훅, 멀티 프로젝트 동시 뷰.
  summary 제외로 **Anthropic/OpenAI API 키 불필요**.

## 2. 아키텍처

두 파트로 나뉜다.

### 2.1 대시보드 인프라 — 레포 밖

위치: `../claude-observability/` (이 Next.js 레포 **밖** 별도 디렉터리). 원본 레포를 git clone.

- **서버**: Bun, 포트 `4000`. SQLite(WAL) 저장 + WebSocket 브로드캐스트.
  - `POST /events` (수신), `GET /events/recent`, `GET /events/filter-options`, `WS /stream`.
- **클라이언트**: Vue 3 + Vite, 포트 `5173`. 실시간 타임라인·필터·라이브 차트·chat transcript 뷰.

별도 디렉터리이므로 Next.js 레포의 git/빌드/타입을 오염시키지 않고, 업스트림 갱신은 `git pull` 로 끝난다.

### 2.2 이벤트 전송 훅 — 이 프로젝트

위치: `.claude/hooks/`. 원본에서 **관찰에 필요한 파일만** 복사한다.

- 복사: `send_event.py` + 그것이 import 하는 최소 `utils/`(예: `constants.py`, `model_extractor.py`).
  실제 import 목록은 구현 단계에서 `send_event.py` 를 읽고 확정한다.
- 제외: `notification.py`·`pre_tool_use.py`·`stop.py` 등 동작 스크립트, `utils/summarizer.py`,
  `utils/llm/`, `utils/tts/`, `validators/`, `examples/`, `test_hitl.py`.

### 2.3 데이터 흐름

```
Claude Code 이벤트
  → .claude/hooks/send_event.py  (uv run)
  → POST http://localhost:4000/events
  → 서버: SQLite 저장 + WS broadcast
  → Vue 대시보드(:5173) 실시간 표시
```

이벤트 payload 필드: `source_app`, `session_id`, `hook_event_type`, `payload`(tool_name/tool_input/결과 등).

## 3. 훅 배선 (`.claude/settings.json`)

관찰 전용. 각 이벤트에서 `send_event.py` **단일 호출**, `--summarize` 없음. `Stop` 만 `--add-chat`
(transcript 전송 — chat 뷰용, API 불필요).

```
uv run .claude/hooks/send_event.py --source-app scwonderland --event-type <EventType>
```

대상 이벤트 9개:

| Event | 추가 플래그 |
|---|---|
| SessionStart | — |
| UserPromptSubmit | — |
| PreToolUse | — |
| PostToolUse | — |
| Notification | — |
| Stop | `--add-chat` |
| SubagentStop | — |
| PreCompact | — |
| SessionEnd | — |

`source_app` = `scwonderland`.

## 4. 제거 대상 (teardown)

### 4.1 기존 하네스 훅 — 전부 제거

실행 파일:

- `.claude/hooks/session-start.mjs` (ARCHITECTURE.md 주입)
- `.claude/hooks/pre-tool-use-agents.mjs` (AGENTS.md 주입)
- `.claude/hooks/worktree.ps1` (Windows 전용, Linux 에선 죽은 코드)
- `.claude/hooks/session-start.log`, `.claude/hooks/pre-tool-use.log`

`.claude/settings.json` 등록 — 전부 교체:

- `SessionStart` (mjs + graph status), `PreToolUse` (mjs), `PostToolUse` (graph update),
  `WorktreeCreate`/`WorktreeRemove` (ps1) → 삭제 후 §3 관찰 훅으로 재작성.

### 4.2 code-review-graph MCP — 완전 제거

- `.mcp.json`: `code-review-graph` 항목 삭제 (`supabase` 는 유지).
- `.claude/settings.local.json`: `enabledMcpjsonServers` 에서 `code-review-graph` 제거.
- `.claude/settings.json`: SessionStart status / PostToolUse update 훅 제거(§4.1 과 동일).
- `CLAUDE.md`: `## MCP Tools: code-review-graph` 섹션 전체 삭제.
- `.claude/skills/explore-codebase/skill.md`: graph 툴 사용을 지시하는 커스텀 스킬 →
  graph 제거로 무의미. **스킬 삭제** (사용자 확인 항목, §7).

## 5. 유지 경계 (이번에 안 건드림)

- `CLAUDE.md`(graph 섹션 외) / `ARCHITECTURE.md` / `AGENTS.md`(5개) → 유지. 규칙·문서는 보존.
- `docs/HARNESS.md`: 현재 내용은 옛 하네스를 설명 → stale. 새 하네스 기준으로 **다시 작성**.
- `.understand-anything/`, `docs/review/REVIEW_SUMMARY.md`: 별개 산출물/스냅샷 → 범위 밖.
- `supabase` MCP: 유지.

## 6. 선행 설치 (현재 미설치)

- **Bun** — 서버 + 클라이언트 실행.
- **uv** — Python 훅 실행 (`uv run`).
- (Node 24 / pnpm / Docker / Python 3.14 는 설치돼 있음.)

## 7. 사용자 확인 항목

- `.claude/skills/explore-codebase/skill.md` 를 **삭제**한다(graph 의존이라 무의미). 보존·재작성 원하면 알린다.

## 8. 검증

- 서버(`:4000`) + 클라이언트(`:5173`) 기동 후 대시보드 접속.
- 이 프로젝트에서 Claude Code 액션 1회 → 대시보드에 이벤트 실시간 표시 확인.
- `pnpm lint` / `pnpm type-check` 영향 없음(하네스 파일은 전부 `src/` 밖).
- 훅 단독 테스트: 서버 켠 상태에서
  `echo '{...}' | uv run .claude/hooks/send_event.py --source-app scwonderland --event-type PreToolUse`
  → 서버 로그/대시보드에 1건 도착.

## 9. 비범위 (YAGNI)

summary/LLM, TTS, 보안 차단 훅, 멀티 프로젝트 뷰, 자동 로그 회전.
