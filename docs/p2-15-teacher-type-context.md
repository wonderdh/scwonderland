# P2-15: 원어민 교사 UI Context Provider 도입

> 작업일: 2026-03-16
> 커밋: `f8665ac`

---

## 배경 — 기존 문제

SC Wonderland 교사 포털(`/academy/teacher/`)은 **한국인 교사**와 **원어민(Native) 교사** 두 가지 UI를 지원합니다. 원어민 교사에게는 메뉴·라벨·메시지가 영어로 표시됩니다(`lib/teacher-labels.ts`의 9개 라벨 세트).

### 기존 구조의 문제점

각 페이지와 클라이언트 컴포넌트가 `teacher_type`을 **각자 개별 DB 조회**로 가져오거나, **prop으로 전달받는 방식**이었습니다.

```
teacher/layout.tsx          (서버)  → DB 조회 → teacherType
  ↓ TeacherNav에 prop 전달
  ↓ children 에는 전달 없음

reports/page.tsx            (서버)  → getCurrentTeacherProfile() → 또 DB 조회
  ↓ TeacherReportClient에 teacherType prop 전달

textbooks/page.tsx          (서버)  → getCurrentTeacherProfile() → 또 DB 조회
  ↓ TeacherTextbookClient에 teacherType prop 전달
```

**문제점 두 가지:**
1. `teacher_type`을 레이아웃과 각 페이지가 **중복 조회** (layout + page 각각 DB hit)
2. 클라이언트 컴포넌트가 깊어질수록 **prop drilling** 발생

---

## 해결 방안 — React Context Provider

Next.js App Router에서 서버 컴포넌트는 React Context를 직접 제공할 수 없습니다. 따라서 다음 구조를 사용합니다.

```
TeacherLayout (서버 컴포넌트)
  └─ teacherType을 DB에서 한 번 조회
  └─ TeacherTypeProvider (클라이언트 컴포넌트) ← Context 제공
      └─ {children}
           └─ TeacherReportClient   → useTeacherType() 훅으로 바로 접근
           └─ TeacherTextbookClient → useTeacherType() 훅으로 바로 접근
```

---

## 구현 내용

### 1. 신규 파일: `TeacherTypeContext.tsx`

**경로:** `app/(academy)/academy/teacher/components/TeacherTypeContext.tsx`

```tsx
"use client";

import { createContext, useContext } from "react";
import type { TeacherType } from "@/lib/teacher-labels";

const TeacherTypeContext = createContext<TeacherType>("korean");

export function TeacherTypeProvider({
  teacherType,
  children,
}: {
  teacherType: TeacherType;
  children: React.ReactNode;
}) {
  return (
    <TeacherTypeContext.Provider value={teacherType}>
      {children}
    </TeacherTypeContext.Provider>
  );
}

export function useTeacherType(): TeacherType {
  return useContext(TeacherTypeContext);
}
```

- `"use client"` 지시어로 클라이언트 컴포넌트
- 기본값은 `"korean"` (서버 오류 시 한국어 UI 유지)
- `TeacherType = "korean" | "native"` (`lib/teacher-labels.ts`)

---

### 2. 수정: `teacher/layout.tsx`

`TeacherTypeProvider`로 `{children}` 감쌈:

```tsx
// Before
return (
  <div className="mx-auto max-w-4xl">
    <TeacherNav teacherType={teacherType} />
    {children}
  </div>
);

// After
return (
  <div className="mx-auto max-w-4xl">
    <TeacherNav teacherType={teacherType} />
    <TeacherTypeProvider teacherType={teacherType}>
      {children}
    </TeacherTypeProvider>
  </div>
);
```

`TeacherNav`는 이미 prop으로 `teacherType`을 받으므로 변경 없음.

---

### 3. 수정: `TeacherReportClient.tsx`

```tsx
// Before: teacherType prop 직접 수신
export function TeacherReportClient({
  classes,
  initialClassId,
  teacherType,          // ← prop
}: {
  classes: TeacherClassWithStudents[];
  initialClassId: string | null;
  teacherType: "korean" | "native";  // ← prop 타입
}) {
  const L = reportLabels[teacherType];
  ...
}

// After: Context hook 사용
export function TeacherReportClient({
  classes,
  initialClassId,
}: {
  classes: TeacherClassWithStudents[];
  initialClassId: string | null;
  // teacherType 제거
}) {
  const teacherType = useTeacherType();  // ← hook
  const L = reportLabels[teacherType];
  ...
}
```

---

### 4. 수정: `TeacherTextbookClient.tsx`

동일 패턴 적용:
```tsx
// Before
export function TeacherTextbookClient({ classes, initialClassId, initialTextbooks, teacherType }) { ... }

// After
export function TeacherTextbookClient({ classes, initialClassId, initialTextbooks }) {
  const teacherType = useTeacherType();
  ...
}
```

---

### 5. 수정: 서버 페이지들

**`reports/page.tsx`**: `teacherType` prop 전달 제거

```tsx
// Before
return (
  <TeacherReportClient
    classes={classes}
    initialClassId={params.class ?? null}
    teacherType={profile?.teacher_type ?? "native"}  // ← 제거
  />
);

// After
return (
  <TeacherReportClient
    classes={classes}
    initialClassId={params.class ?? null}
  />
);
```

> `getCurrentTeacherProfile()` 호출은 `redirect("/academy/teacher")` 가드용으로 유지.

**`textbooks/page.tsx`**: 동일하게 `teacherType` prop 제거 및 `getCurrentTeacherProfile()` 호출도 불필요해져 제거.

---

## 변경 파일 목록

| 파일 | 변경 유형 |
|------|----------|
| `components/TeacherTypeContext.tsx` | 신규 생성 |
| `layout.tsx` | `TeacherTypeProvider` 추가 |
| `components/TeacherReportClient.tsx` | prop → hook |
| `components/TeacherTextbookClient.tsx` | prop → hook |
| `reports/page.tsx` | prop 전달 제거 |
| `textbooks/page.tsx` | prop 전달 제거 및 불필요 조회 제거 |

---

## 적용되지 않은 컴포넌트

아래 항목은 변경 대상에서 제외:

| 컴포넌트/라벨 | 이유 |
|--------------|------|
| `TeacherNav.tsx` | layout에서 직접 prop 전달이 더 명확함 |
| `busLabels` | `native` 변형 없음 |
| `noticeLabels` | `native` 변형 없음 |
| 서버 컴포넌트 페이지 | Context는 클라이언트에서만 사용 가능 |

---

## 효과

- 클라이언트 컴포넌트에서 `teacherType` **prop drilling 완전 제거**
- `teacher_type` DB 조회 경로 단일화 (layout에서 한 번만)
- 향후 teacher 하위에 클라이언트 컴포넌트 추가 시 **prop 없이 바로 `useTeacherType()` 사용 가능**

---

## 사용 방법

```tsx
// teacher 하위 어느 클라이언트 컴포넌트에서든
import { useTeacherType } from "../components/TeacherTypeContext";

export function SomeTeacherComponent() {
  const teacherType = useTeacherType();
  const L = someLabels[teacherType]; // "korean" | "native"
  ...
}
```
