---
name: explain-md
description: >
  Save the current session's topic — concepts, decisions, code references — as a structured markdown note in the project's gitignored _notes/ folder.
  Triggers when the user asks to '내용 정리해서 md로 출력', '설명 md로 남겨줘', '노트로 남겨', '이 내용 md로 정리해줘', 'explain to md', '리뷰 노트 만들어줘', 'md로 문서화해줘' or similar.
triggers:
  - "내용 정리해서 md로 출력"
  - "설명 md로 남겨줘"
  - "노트로 남겨"
  - "이 내용 md로 정리해줘"
  - "explain to md"
  - "리뷰 노트 만들어줘"
  - "md로 문서화해줘"
  - "다음에도 비슷하게 출력해달라고 하면"
tags:
  - documentation
  - notes
  - knowledge
---

## 목적

세션에서 다룬 주제·결정·코드 흐름을 1차 자료로 `_notes/` 폴더에 남겨,
다음 세션이 대화 맥락 없이도 빠르게 컨텍스트를 회복할 수 있게 한다.
이 skill은 노트 작성 전용이며 코드 수정·마이그레이션·설정 변경은 수행하지 않는다.

---

## 트리거 표현

다음 발화 중 하나가 감지되면 이 skill을 실행한다.

| 트리거 | 예시 발화 |
|--------|-----------|
| 내용 정리해서 md로 출력 | "오늘 다룬 내용 정리해서 md로 출력해줘" |
| 설명 md로 남겨줘 | "방금 설명한 것 md로 남겨줘" |
| 노트로 남겨 | "이거 노트로 남겨" |
| 이 내용 md로 정리해줘 | "RLS 관련 내용 md로 정리해줘" |
| explain to md | "explain to md please" |
| 리뷰 노트 만들어줘 | "오늘 세션 리뷰 노트 만들어줘" |
| md로 문서화해줘 | "패턴 정리해서 md로 문서화해줘" |
| 다음에도 비슷하게 출력 | "이런 설명 md를 다음에도 비슷하게 출력해달라고 하면 그렇게 해줘" |

---

## 출력 위치

1. 프로젝트 루트의 `_notes/` 폴더에 파일을 생성한다.
2. 폴더가 없으면 `mkdir -p _notes` 로 생성한다.
3. `.gitignore`에 `_notes/` 항목이 있는지 확인한다.
   - 이미 있으면 그대로 진행한다.
   - 없으면 `.gitignore` 끝에 `_notes/` 한 줄을 추가한다.

> 이 프로젝트의 `.gitignore`에는 이미 `_notes/` 항목이 등재되어 있으므로 추가 수정 불필요.

---

## 파일명 규칙

```
YYYYMMDD_kebab-case-topic.md
```

- `YYYYMMDD` — KST 기준 오늘 날짜 (`todayKst()` 활용)
- `kebab-case-topic` — 세션 주제를 소문자 영어 또는 한국어 발음 기반 케밥케이스로 요약
- 같은 날 같은 주제 파일이 이미 존재하면 `_v2`, `_v3` 접미사를 붙인다

예:
```
20260427_rls-helper-calls.md
20260427_rls-helper-calls_v2.md
20260427_ssr-initial-fetch-pattern.md
```

---

## md 구조 (필수 섹션)

아래 7개 섹션을 **항상** 이 순서로 포함한다.

```markdown
# 제목
(한 줄, 세션 주제 요약)

## Context
왜 이 노트를 남기는가 — 배경, 문제 상황, 목적을 한 단락으로.

## 핵심 개념
사용자가 헷갈렸거나 새로 배운 개념을 항목별로 설명.
- **개념명**: 설명

## 프로젝트 적용
이 프로젝트의 어느 파일·함수·패턴이 관련되는지 경로와 함께 인용.
- `src/path/to/file.ts` — 역할 설명

## 의사결정 / 트레이드오프
세션에서 결정된 것, 채택한 이유, 거절한 대안.
- **결정**: 내용
- **거절한 대안**: 이유

## 체크리스트
향후 같은 작업을 반복할 때 따라할 항목 5~10개.
- [ ] 항목 1
- [ ] 항목 2
...

## 참고 링크
- 외부 문서 URL
- 내부 `rules/`, `routes/` 경로
- 관련 commit SHA 또는 PR URL
```

---

## 언어

- 사용자가 한국어로 요청 → 한국어로 작성
- 사용자가 영어로 요청 → 영어로 작성
- 명시 없으면 요청 메시지의 주 언어와 동일하게

---

## 종료 보고

파일 작성 완료 후 **한 줄**로 사용자에게 보고하고 추가 행동 없이 종료한다.

형식:
```
노트 저장됨: `_notes/20260427_rls-helper-calls.md` (총 N줄)
```

---

## 하지 말 것

| 금지 사항 | 이유 |
|-----------|------|
| `_notes/` 외 위치에 파일 생성 | 노트 산재 방지 |
| 출력 전 사용자에게 재확인 | 이 skill 호출 시점은 이미 사용자 요청 직후 |
| 코드 수정·마이그레이션 작성 | 이 skill은 노트 작성 전용 |
| secret·credential·.env 내용 포함 | 보안 — 절대 금지 |
| 섹션 누락 | 7개 필수 섹션은 항상 포함 |
