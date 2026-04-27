# SC Wonderland Claude Harness

이 문서는 Claude Code가 이 저장소에서 작업할 때 따르는 최상위 규칙이다.

## 기본 행동 원칙

### 1. 코딩 전 생각하기
- 가정을 명시한다. 모호하면 질문하거나 plan에 가정으로 고정한다.
- 여러 해석이 가능하면 조용히 하나를 고르지 말고 tradeoff를 드러낸다.
- 더 단순한 접근이 있으면 먼저 제안한다.

### 2. 단순함 우선
- 요청 범위 밖 기능을 만들지 않는다.
- 한 번만 쓰는 코드를 위해 추상화를 만들지 않는다.
- 불필요한 설정화, 일반화, 방어 코드를 추가하지 않는다.
- 200줄로 쓴 코드가 50줄로 가능하면 줄인다.

### 3. 외과적 변경
- 사용자 요청에 직접 연결되는 줄만 바꾼다.
- 주변 코드 개선, 포맷 변경, 리팩터링은 별도 요청 없이는 하지 않는다.
- 기존 스타일을 따른다.
- 내 변경으로 생긴 unused import/변수/함수만 정리한다.

### 4. 목표 기반 실행
- 구현 전 성공 기준과 검증 방법을 plan에 적는다.
- 버그 수정은 재현 조건과 통과 기준을 함께 둔다.
- 완료 전 tester와 docs-auditor 결과를 확인한다.

## 필수 하네스 규칙

1. `main` branch는 오케스트레이션 전용이다. 코드, 설정, script, package 파일을 직접 수정하지 않는다.
2. 작업은 `npm run harness -- worktree start <task-slug>`로 만든 `claude/<task-slug>` worktree에서 수행한다.
3. 코드 수정 전 `.claude/plans/active/`에 active plan이 있어야 한다.
4. 구조 변경이 있으면 관련 md를 반드시 최신화한다. 문서 최신화는 코드 변경의 일부다.
5. 테스트/빌드/검증은 main agent가 직접 실행하지 않는다. `tester` subagent 결과만 완료 조건으로 인정한다.
6. 문서 drift와 예외 승인은 `docs-auditor` subagent가 담당한다.
7. 병렬 작업은 file ownership을 먼저 나누고, 같은 파일을 두 subagent가 동시에 수정하지 않는다.
8. 완료는 `npm run harness -- finish <plan-file>`로만 처리한다.

## 항상 읽을 문서

- `STRUCTURE.md`
- `HARNESS_MANIFEST.json`
- `.claude/rules/core.md`
- `.claude/rules/workflow.md`
- `.claude/rules/docs-sync.md`
- `.claude/rules/testing.md`
- `.claude/routes/_index.md`

## 작업 흐름

1. `/start-task` skill 또는 `npm run harness -- worktree start <slug>`로 작업 worktree를 만든다.
2. `.claude/plans/templates/PLAN_TEMPLATE.md`를 active plan으로 복사한다.
3. `npm run harness -- context <prompt-or-path>`로 관련 route/rule/docs를 확인한다.
4. `worker` subagent가 구현한다.
5. `docs-sync` skill과 `docs-auditor` subagent가 문서 최신화를 확인한다.
6. `tester` subagent가 필수 검증을 실행한다.
7. `finish-task` skill 또는 `npm run harness -- finish <plan-file>`로 completed 이동을 처리한다.
