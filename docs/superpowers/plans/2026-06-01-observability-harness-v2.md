# 옵저버빌리티 하네스 v2 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 기존 Claude Code 하네스(컨텍스트 주입·graph MCP·워크트리 훅)를 전부 제거하고, summary(LLM) 없이 Claude Code 세션 이벤트를 실시간 대시보드로 보는 옵저버빌리티 하네스로 교체한다.

**Architecture:** 두 파트. (1) 레포 **밖** `../claude-observability/` 에 원본 레포(Bun 서버 :4000 + Vue 클라이언트 :5173)를 clone 해 대시보드 인프라로 띄운다. (2) 이 프로젝트 `.claude/hooks/` 에 `send_event.py`(관찰 전용)만 두고, 각 Claude Code 이벤트에서 `uv run` 으로 호출해 서버로 POST 한다.

**Tech Stack:** Bun(서버), Vue 3 + Vite(클라이언트), Python + uv(훅), SQLite, WebSocket. 설치 전제: Node 24 / pnpm / Docker / Python 3.14 (이미 있음), Bun · uv (이번에 설치).

**스펙:** `docs/superpowers/specs/2026-06-01-observability-harness-v2-design.md`

**커밋 정책:** 이 레포 규칙상 커밋은 사용자 요청 시에만. 각 Task 끝의 커밋 스텝은 체크포인트 제안이며, 사용자가 원할 때 실행한다. 먼저 Task 0 에서 작업 브랜치를 만든다.

---

## Task 0: 작업 브랜치 생성

**Files:** (git 상태만)

- [ ] **Step 1: 현재 브랜치 확인**

Run: `git -C /home/wonderdh/projects/scwonderland branch --show-current`
Expected: `main`

- [ ] **Step 2: 작업 브랜치 생성**

```bash
git -C /home/wonderdh/projects/scwonderland switch -c feat/observability-harness-v2
```
Expected: `Switched to a new branch 'feat/observability-harness-v2'`

---

## Task 1: Bun · uv 설치

**Files:** (시스템 도구 설치 — 레포 파일 변경 없음)

- [ ] **Step 1: Bun 설치**

```bash
curl -fsSL https://bun.sh/install | bash
```

- [ ] **Step 2: uv 설치**

```bash
curl -LsSf https://astral.sh/uv/install.sh | sh
```

- [ ] **Step 3: 새 셸 PATH 반영 후 버전 확인**

Run:
```bash
export PATH="$HOME/.bun/bin:$HOME/.local/bin:$PATH"
bun --version && uv --version
```
Expected: 두 줄 모두 버전 출력(예: `1.x.x` / `uv 0.x.x`). 에러 없이 종료.

> 주의: 이후 모든 `bun`/`uv` 명령은 위 PATH 가 반영된 셸에서 실행. 영구 반영은 `~/.bashrc` 에 설치 스크립트가 추가한 라인을 새 셸에서 로드.

---

## Task 2: 대시보드 인프라 clone · 기동

**Files:**
- Create: `../claude-observability/` (레포 밖, git clone)

- [ ] **Step 1: 레포 밖에 clone**

```bash
git clone https://github.com/disler/claude-code-hooks-multi-agent-observability.git /home/wonderdh/projects/claude-observability
```
Expected: clone 완료, `/home/wonderdh/projects/claude-observability/apps/server` 와 `apps/client` 존재.

- [ ] **Step 2: 서버 의존성 설치**

```bash
cd /home/wonderdh/projects/claude-observability/apps/server && bun install
```
Expected: 에러 없이 설치 완료.

- [ ] **Step 3: 클라이언트 의존성 설치**

```bash
cd /home/wonderdh/projects/claude-observability/apps/client && bun install
```
Expected: 에러 없이 설치 완료. (npm 대신 bun 으로 통일. npm 으로 해도 무방하나 한 도구로 유지.)

- [ ] **Step 4: 서버 백그라운드 기동**

```bash
cd /home/wonderdh/projects/claude-observability/apps/server && bun run dev
```
(백그라운드 실행) Expected: `:4000` listen 로그.

- [ ] **Step 5: 서버 헬스 확인**

Run: `curl -s http://localhost:4000/events/filter-options`
Expected: JSON 응답(예: `{"source_apps":[],"session_ids":[],"hook_event_types":[]}` 또는 유사). HTTP 연결 성공.

- [ ] **Step 6: 클라이언트 백그라운드 기동 후 접속 확인**

```bash
cd /home/wonderdh/projects/claude-observability/apps/client && bun run dev
```
(백그라운드 실행) 그 후 Run: `curl -s -o /dev/null -w "%{http_code}" http://localhost:5173`
Expected: `200`. 브라우저로 `http://localhost:5173` 접속 시 빈 대시보드 표시.

---

## Task 3: 옵저버빌리티 훅 스크립트 배치 (`send_event.py`)

**Files:**
- Create: `/home/wonderdh/projects/scwonderland/.claude/hooks/send_event.py` (원본 복사)
- Create: `/home/wonderdh/projects/scwonderland/.claude/hooks/utils/model_extractor.py` (원본 복사)
- Create: `/home/wonderdh/projects/scwonderland/.claude/hooks/utils/summarizer.py` (stub, 신규)

- [ ] **Step 1: 원본 send_event.py + model_extractor.py 가져오기**

```bash
cd /home/wonderdh/projects/scwonderland
mkdir -p .claude/hooks/utils
cp /home/wonderdh/projects/claude-observability/.claude/hooks/send_event.py .claude/hooks/send_event.py
cp /home/wonderdh/projects/claude-observability/.claude/hooks/utils/model_extractor.py .claude/hooks/utils/model_extractor.py
```
Expected: 두 파일 생성.

- [ ] **Step 2: send_event.py PEP723 deps 에서 anthropic 제거**

`.claude/hooks/send_event.py` 상단 PEP723 블록에서 `anthropic` 의존 라인 한 줄만 삭제한다.
삭제 전:
```python
# dependencies = [
#     "anthropic",
#     "python-dotenv",
# ]
```
삭제 후:
```python
# dependencies = [
#     "python-dotenv",
# ]
```
(send_event.py 본문 코드는 건드리지 않는다.)

- [ ] **Step 3: stub summarizer.py 작성**

send_event.py 가 top-level 에서 `from utils.summarizer import generate_event_summary` 를 하므로,
anthropic 없이 import 를 만족시키는 stub 을 둔다. `--summarize` 를 절대 넘기지 않으므로 호출되지 않는다.

`.claude/hooks/utils/summarizer.py` 전체 내용:
```python
"""Observability 전용 stub. summary(LLM) 기능 비활성 — API 키 불필요.

send_event.py 가 top-level 에서 generate_event_summary 를 import 하므로 이름만 제공한다.
--summarize 플래그를 쓰지 않는 한 호출되지 않는다.
"""


def generate_event_summary(event_data):
    return None
```

- [ ] **Step 4: 훅 단독 동작 확인 (서버 켜진 상태)**

Run:
```bash
cd /home/wonderdh/projects/scwonderland
echo '{"session_id":"plan-test","transcript_path":"/tmp/none.jsonl","hook_event_type":"PreToolUse","tool_name":"Bash","tool_input":{"command":"ls"}}' \
  | uv run .claude/hooks/send_event.py --source-app scwonderland --event-type PreToolUse
```
Expected: 종료 코드 0, 에러 트레이스백 없음(특히 `ModuleNotFoundError: anthropic` 가 **없어야** 함).

- [ ] **Step 5: 서버에 도착했는지 확인**

Run: `curl -s "http://localhost:4000/events/recent?limit=5"`
Expected: 방금 보낸 이벤트(`source_app":"scwonderland"`, `hook_event_type":"PreToolUse"`)가 JSON 배열에 포함. 대시보드(:5173)에도 1건 표시.

- [ ] **Step 6: 커밋(요청 시)**

```bash
git add .claude/hooks/send_event.py .claude/hooks/utils/
git commit -m "feat(harness): add observability send_event hook (no summary)"
```

---

## Task 4: settings.json 재작성 (구 훅 제거 + 관찰 훅 배선)

**Files:**
- Modify(전체 교체): `/home/wonderdh/projects/scwonderland/.claude/settings.json`
- Delete: `.claude/hooks/session-start.mjs`, `.claude/hooks/pre-tool-use-agents.mjs`, `.claude/hooks/worktree.ps1`, `.claude/hooks/session-start.log`, `.claude/hooks/pre-tool-use.log`

- [ ] **Step 1: 구 훅 실행 파일 + 로그 삭제**

```bash
cd /home/wonderdh/projects/scwonderland
rm -f .claude/hooks/session-start.mjs .claude/hooks/pre-tool-use-agents.mjs .claude/hooks/worktree.ps1 .claude/hooks/session-start.log .claude/hooks/pre-tool-use.log
```
Expected: `.claude/hooks/` 에는 `send_event.py` 와 `utils/` 만 남음.

- [ ] **Step 2: settings.json 전체를 관찰 훅으로 교체**

`.claude/settings.json` 전체 내용을 아래로 교체(graph status/update·mjs·ps1 훅 전부 제거):
```json
{
  "hooks": {
    "SessionStart": [
      {
        "hooks": [
          { "type": "command", "command": "uv run .claude/hooks/send_event.py --source-app scwonderland --event-type SessionStart" }
        ]
      }
    ],
    "UserPromptSubmit": [
      {
        "hooks": [
          { "type": "command", "command": "uv run .claude/hooks/send_event.py --source-app scwonderland --event-type UserPromptSubmit" }
        ]
      }
    ],
    "PreToolUse": [
      {
        "matcher": "",
        "hooks": [
          { "type": "command", "command": "uv run .claude/hooks/send_event.py --source-app scwonderland --event-type PreToolUse" }
        ]
      }
    ],
    "PostToolUse": [
      {
        "matcher": "",
        "hooks": [
          { "type": "command", "command": "uv run .claude/hooks/send_event.py --source-app scwonderland --event-type PostToolUse" }
        ]
      }
    ],
    "Notification": [
      {
        "hooks": [
          { "type": "command", "command": "uv run .claude/hooks/send_event.py --source-app scwonderland --event-type Notification" }
        ]
      }
    ],
    "Stop": [
      {
        "hooks": [
          { "type": "command", "command": "uv run .claude/hooks/send_event.py --source-app scwonderland --event-type Stop --add-chat" }
        ]
      }
    ],
    "SubagentStop": [
      {
        "hooks": [
          { "type": "command", "command": "uv run .claude/hooks/send_event.py --source-app scwonderland --event-type SubagentStop" }
        ]
      }
    ],
    "PreCompact": [
      {
        "hooks": [
          { "type": "command", "command": "uv run .claude/hooks/send_event.py --source-app scwonderland --event-type PreCompact" }
        ]
      }
    ],
    "SessionEnd": [
      {
        "hooks": [
          { "type": "command", "command": "uv run .claude/hooks/send_event.py --source-app scwonderland --event-type SessionEnd" }
        ]
      }
    ]
  }
}
```

- [ ] **Step 3: JSON 유효성 확인**

Run: `node -e "JSON.parse(require('fs').readFileSync('.claude/settings.json','utf8')); console.log('ok')"`
Expected: `ok`

- [ ] **Step 4: 커밋(요청 시)**

```bash
git add .claude/settings.json .claude/hooks/
git commit -m "refactor(harness): replace legacy hooks with observability event wiring"
```

---

## Task 5: code-review-graph MCP 완전 제거

**Files:**
- Modify: `/home/wonderdh/projects/scwonderland/.mcp.json`
- Modify: `/home/wonderdh/projects/scwonderland/.claude/settings.local.json`
- Modify: `/home/wonderdh/projects/scwonderland/CLAUDE.md`
- Delete: `/home/wonderdh/projects/scwonderland/.claude/skills/explore-codebase/` (디렉터리)

- [ ] **Step 1: .mcp.json 에서 code-review-graph 제거 (supabase 유지)**

`.mcp.json` 전체 내용을 아래로 교체:
```json
{
  "mcpServers": {
    "supabase": {
      "type": "http",
      "url": "https://mcp.supabase.com/mcp"
    }
  }
}
```

- [ ] **Step 2: settings.local.json 에서 code-review-graph 제거**

`.claude/settings.local.json` 전체 내용을 아래로 교체:
```json
{
  "enabledMcpjsonServers": [
    "supabase"
  ]
}
```

- [ ] **Step 3: CLAUDE.md 의 graph 섹션 삭제**

`CLAUDE.md` 끝의 `## MCP Tools: code-review-graph` 헤더부터 파일 끝(EOF)까지 전체를 삭제한다.
(그 위 `## 문서` 섹션까지가 마지막으로 남는다.)

- [ ] **Step 4: explore-codebase 스킬 삭제**

```bash
cd /home/wonderdh/projects/scwonderland
rm -rf .claude/skills/explore-codebase
```
Expected: 디렉터리 제거됨.

- [ ] **Step 5: 잔존 참조 점검**

Run:
```bash
cd /home/wonderdh/projects/scwonderland
grep -rn "code-review-graph" . --include="*.json" --include="*.md" 2>/dev/null | grep -v node_modules | grep -v ".understand-anything" | grep -v "docs/review/REVIEW_SUMMARY.md" | grep -v "docs/superpowers/"
```
Expected: 출력 없음(빈 결과). (`.understand-anything/`·`docs/review/REVIEW_SUMMARY.md`·`docs/superpowers/` 스펙·플랜은 범위 밖이라 제외.)

- [ ] **Step 6: 커밋(요청 시)**

```bash
git add .mcp.json .claude/settings.local.json CLAUDE.md
git rm -r --cached .claude/skills/explore-codebase 2>/dev/null || true
git add -A .claude/skills
git commit -m "chore(harness): remove code-review-graph MCP and dependent skill"
```

---

## Task 6: HARNESS.md 를 v2 기준으로 재작성

**Files:**
- Modify(전체 교체): `/home/wonderdh/projects/scwonderland/docs/HARNESS.md`

- [ ] **Step 1: docs/HARNESS.md 전체 교체**

`docs/HARNESS.md` 전체 내용을 아래로 교체:
```markdown
# SC Wonderland Harness

이 프로젝트의 Claude Code 협업 도구(하네스). **하네스 관련 작업** — 훅 추가/수정, `.claude/settings.json`·`.mcp.json` 수정 — 을 하기 전에 이 문서를 읽는다.

## 현재 상태 (v2, 2026-06-01)

옵저버빌리티 단일 목적. 이전의 컨텍스트 주입(.mjs)·code-review-graph MCP·워크트리(.ps1) 훅은 전부 제거됨(clean slate).

- **목적**: Claude Code 세션 이벤트를 실시간 대시보드로 관찰. summary(LLM) 기능은 비활성 → API 키 불필요.
- **두 파트**:
  1. **대시보드 인프라** — 레포 밖 `../claude-observability/` (원본 [claude-code-hooks-multi-agent-observability](https://github.com/disler/claude-code-hooks-multi-agent-observability) clone). Bun 서버(`:4000`, SQLite + WebSocket) + Vue 클라이언트(`:5173`).
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
2. 브라우저로 `http://localhost:5173` 접속.
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
기대: 종료 코드 0, `recent` 응답에 방금 이벤트 포함, 대시보드(:5173)에 1건 표시.

`pnpm lint` / `pnpm type-check` 영향 없음(하네스 파일은 전부 `src/` 밖).

## 비범위 (YAGNI)

summary/LLM, TTS 음성, 위험명령 차단 보안 훅, 멀티 프로젝트 동시 뷰, 컨텍스트 자동 주입(ARCHITECTURE.md/AGENTS.md), 로그 회전.

## 관련

- 설계: `docs/superpowers/specs/2026-06-01-observability-harness-v2-design.md`
- 계획: `docs/superpowers/plans/2026-06-01-observability-harness-v2.md`
```

- [ ] **Step 2: 커밋(요청 시)**

```bash
git add docs/HARNESS.md
git commit -m "docs(harness): rewrite HARNESS.md for observability v2"
```

---

## Task 7: 엔드투엔드 검증

**Files:** (검증만)

- [ ] **Step 1: 대시보드 인프라 가동 상태 확인**

Run: `curl -s -o /dev/null -w "server=%{http_code}\n" http://localhost:4000/events/filter-options; curl -s -o /dev/null -w "client=%{http_code}\n" http://localhost:5173`
Expected: `server=200` / `client=200`.

- [ ] **Step 2: 실제 Claude Code 액션으로 이벤트 발생**

이 프로젝트에서 Claude Code 로 아무 도구 1회 실행(예: 파일 Read 또는 Bash `ls`). PreToolUse/PostToolUse 훅이 발동.

- [ ] **Step 3: 대시보드에 실시간 표시 확인**

브라우저 `http://localhost:5173` 에서 `source_app = scwonderland` 이벤트가 실시간으로 뜨는지 확인.
또는 Run: `curl -s "http://localhost:4000/events/recent?limit=10"` → 최근 이벤트에 `scwonderland` 다수 포함.
Expected: PreToolUse/PostToolUse 등 이벤트가 보임.

- [ ] **Step 4: 빌드 무영향 확인**

Run: `cd /home/wonderdh/projects/scwonderland && pnpm type-check`
Expected: exit 0 (하네스 변경이 앱 빌드에 영향 없음).

---

## 완료 기준

- 구 훅(.mjs/.ps1)·로그·graph MCP·explore-codebase 스킬 모두 제거됨.
- `.claude/settings.json` 이 9개 이벤트를 `send_event.py` 로 배선.
- 서버/클라이언트 기동 후 Claude Code 액션이 대시보드에 실시간 표시.
- `pnpm type-check` 통과.
- `docs/HARNESS.md` 가 v2 를 정확히 기술.
