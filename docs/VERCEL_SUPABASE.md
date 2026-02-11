# Vercel + Supabase 연동 방법

## 1. Supabase에서 값 복사

1. [Supabase](https://supabase.com) 로그인 → 프로젝트 선택
2. 왼쪽 **Project Settings** (톱니바퀴) → **API**
3. 아래 값 복사해 두기:
   - **Project URL** (예: `https://xxxxx.supabase.co`)
   - **anon public** 키 (Public API key)

---

## 2. Vercel에 환경 변수 넣기

1. [Vercel](https://vercel.com) 로그인 → 해당 프로젝트 선택
2. **Settings** → **Environment Variables**
3. 변수 추가:

| Name | Value | 적용 환경 |
|------|--------|-----------|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase Project URL | Production, Preview, Development |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase anon public 키 | Production, Preview, Development |

- **NEXT_PUBLIC_** 붙은 변수만 브라우저(클라이언트)에서 사용 가능합니다.
- 서버에서만 쓰는 비밀 키는 **NEXT_PUBLIC_** 없이 넣고, 서버 코드에서만 사용하세요.

4. 저장 후 **재배포** 한 번 해주면 적용됩니다 (Deployments → ⋮ → Redeploy).

---

## 3. 로컬에서 쓰려면 (.env.local)

프로젝트 루트에 `.env.local` 파일 만들기 (이 파일은 `.gitignore`에 있어서 Git에 안 올라갑니다):

```env
NEXT_PUBLIC_SUPABASE_URL=https://xxxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key-here
```

`npm run dev` 하면 이 값이 로드됩니다.

---

## 4. (선택) Vercel Integration 사용

1. Vercel 프로젝트 **Settings** → **Integrations**
2. **Supabase** 검색 후 **Add Integration**
3. Supabase 계정 연결 → 프로젝트 선택
4. 연결하면 해당 Vercel 프로젝트에 위 환경 변수가 자동으로 채워질 수 있습니다 (버전에 따라 다름).  
   없으면 2번처럼 직접 넣으면 됩니다.

---

## 5. 앱에서 Supabase 쓰기

패키지 설치:

```bash
npm install @supabase/supabase-js
```

클라이언트용 인스턴스 예시 (`lib/supabase.ts` 등):

```ts
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

export const supabase = createClient(supabaseUrl, supabaseAnonKey)
```

서버(API Route, Server Component)에서는 같은 URL/키로 `createClient` 쓰거나, [Supabase SSR 가이드](https://supabase.com/docs/guides/auth/server-side/nextjs)대로 쿠키 기반 세션 쓰면 됩니다.

---

## 요약

| 위치 | 할 일 |
|------|--------|
| **Supabase** | Project Settings → API에서 URL, anon key 복사 |
| **Vercel** | Settings → Environment Variables에 `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` 추가 후 재배포 |
| **로컬** | `.env.local`에 같은 두 변수 넣기 |
