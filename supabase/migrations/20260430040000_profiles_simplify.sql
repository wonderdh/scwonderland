-- profiles: first_name/last_name 제거, username(이메일 로컬파트) + created_at 추가

alter table public.profiles
  drop column if exists first_name,
  drop column if exists last_name,
  add column if not exists username text,
  add column if not exists created_at timestamp with time zone not null default now();

-- 기존 행: auth.users.email 에서 @ 앞부분으로 username 채우기
update public.profiles p
set username = split_part(u.email, '@', 1)
from auth.users u
where u.id = p.id
  and p.username is null
  and u.email is not null;

-- username 중복 방지
create unique index if not exists profiles_username_unique
  on public.profiles (username)
  where username is not null;
