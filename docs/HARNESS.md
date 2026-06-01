# SC Wonderland Harness

이 프로젝트의 Claude Code 협업 도구(하네스). **하네스 관련 작업** — 훅 추가/수정, `.claude/settings.json`·`.mcp.json` 수정 — 을 하기 전에 이 문서를 읽는다.

## 현재 상태 (v2, 2026-06-01)

옵저버빌리티 단일 목적. 이전의 컨텍스트 주입(.mjs)·code-review-graph MCP·워크트리(.ps1) 훅은 전부 제거됨(clean slate).

- **목적**: Claude Code 세션 이벤트를 실시간 대시보드로 관찰. summary(LLM) 기능은 비활성 → API 키 불필요.
- **두 파트**:
  1. **대시보드 인프라** — 레포 밖 `../claude-observability/` (원본 [claude-code-hooks-multi-agent-observability](https://github.com/disler/claude-code-hooks-multi-agent-observability) clone). Bun 서버(`:4000`, SQLite + WebSocket) + Vue 클라이언트(`:6173`, `apps/client/vite.config.ts` 에 strictPort 로 고정 — understand-anything 플러그인 대시보드가 쓰는 5173~ 과 충돌 회피).
  2. **이벤트 전송 훅** — `.claude/hooks/send_event.py`(+ `utils/model_extractor.py`, stub `utils/summarizer.py`). 각 이벤트에서 `uv run` 으로 호출 → `POST :4000/events`.
- **훅 등록**: `.claude/settings.json` — 9개 이벤트(SessionStart, UserPromptSubmit, PreToolUse, PostToolUse, Notification, Stop[`--add-chat`], SubagentStop, PreCompact, SessionEnd) 각각 `send_event.py --source-app scwonderland --event-type <X>`.
- **MCP**: `supabase` 만(`.mcp.json`). code-review-graph 는 제거됨.

## 원칙

1. **summary/LLM 비활성** — `--summarize` 안 씀. `utils/summarizer.py` 는 stub. API 키 의존 없음.
2. **관찰은 비차단** — 훅 전송 실패가 작업을 막지 않는다(서버가 꺼져 있어도 Claude Code 동작엔 영향 없음).
3. **인프라는 레포 밖** — 대시보드(Bun/Vue)는 Next.js 레포의 git/빌드/타입을 오염시키지 않는다.
4. **점진 추가** — 보안 차단·TTS·컨텍스트 주입 등은 필요해질 때 한 기능씩. 무거운 자동화 선재도입 금지.

## 사용법

1. 대시보드 기동: `cd ../claude-observability/apps/server && bun run dev` (그리고 `apps/client && bun run dev`).
2. 브라우저로 `http://localhost:6173` 접속.
3. 이 프로젝트에서 Claude Code 사용 → 이벤트가 실시간으로 대시보드에 흐른다.

서버가 꺼져 있으면 이벤트는 전송 실패하고 버려질 뿐, 작업엔 지장 없다.

## 파일 인벤토리

| 파일 | 역할 |
|---|---|
| `.claude/hooks/send_event.py` | 이벤트를 서버로 POST (관찰 전용) |
| `.claude/hooks/utils/model_extractor.py` | transcript 에서 모델명 추출 (stdlib) |
| `.claude/hooks/utils/summarizer.py` | summary stub (항상 None) |
| `.claude/settings.json` | 9개 이벤트 → send_event.py 배선 |
| `.mcp.json` | MCP 서버 정의(`supabase`) |
| `docs/HARNESS.md` | 이 문서 |
| `../claude-observability/` | 대시보드 인프라(레포 밖, Bun 서버 + Vue 클라이언트) |

## 검증 방법

서버가 켜진 상태에서:
```bash
echo '{"session_id":"t","transcript_path":"/tmp/none.jsonl","hook_event_type":"PreToolUse","tool_name":"Bash","tool_input":{"command":"ls"}}' \
  | uv run .claude/hooks/send_event.py --source-app scwonderland --event-type PreToolUse
curl -s "http://localhost:4000/events/recent?limit=5"
```
기대: 종료 코드 0, `recent` 응답에 방금 이벤트 포함, 대시보드(:6173)에 1건 표시.

`pnpm lint` / `pnpm type-check` 영향 없음(하네스 파일은 전부 `src/` 밖).

## 비범위 (YAGNI)

summary/LLM, TTS 음성, 위험명령 차단 보안 훅, 멀티 프로젝트 동시 뷰, 컨텍스트 자동 주입(ARCHITECTURE.md/AGENTS.md), 로그 회전.

## 관련

- 설계: `docs/superpowers/specs/2026-06-01-observability-harness-v2-design.md`
- 계획: `docs/superpowers/plans/2026-06-01-observability-harness-v2.md`
