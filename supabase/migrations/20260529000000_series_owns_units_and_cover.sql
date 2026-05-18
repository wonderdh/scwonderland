-- series 가 total_units / cover_image_url 를 소유.
--
-- 출발 상태:
--   homework_books { ..., series text(legacy), total_units integer, cover_image_url text, series_id uuid → series.id }
--   series { id, name, publisher_id, is_active, ... }
--
-- 목표 상태:
--   series { id, name, publisher_id, is_active, total_units integer not null default 0, cover_image_url text }
--   homework_books { ..., level, series_id, sort_order, title, ... }  -- legacy series/total_units/cover_image_url DROP
--
-- 트리거 tg_student_homework_book_seed_progress 본문이 hb.total_units → s.total_units 로 갈아탐.

set search_path = public;

-- =================================================================
-- 1. series 에 컬럼 추가
-- =================================================================
alter table public.series
  add column if not exists total_units integer not null default 0;
alter table public.series
  add column if not exists cover_image_url text;

-- =================================================================
-- 2. 백필 — total_units (최빈값 mode), 충돌 시 NOTICE
-- =================================================================
do $$
declare
  r record;
  v_chosen integer;
  v_distinct integer;
  v_values text;
begin
  for r in
    select s.id as series_id, s.name as series_name
    from public.series s
  loop
    select
      mode() within group (order by hb.total_units),
      count(distinct hb.total_units),
      string_agg(distinct hb.total_units::text, ', ' order by hb.total_units::text)
    into v_chosen, v_distinct, v_values
    from public.homework_books hb
    where hb.series_id = r.series_id
      and hb.total_units is not null
      and hb.total_units > 0;

    if v_chosen is not null then
      update public.series set total_units = v_chosen where id = r.series_id;
      if v_distinct > 1 then
        raise notice '[series % "%"] total_units conflict (values: %), picked %',
          r.series_id, r.series_name, v_values, v_chosen;
      end if;
    end if;
  end loop;
end $$;

-- =================================================================
-- 3. 백필 — cover_image_url (최신 updated_at 의 non-null 표지), 충돌 시 NOTICE
-- =================================================================
do $$
declare
  r record;
  v_chosen text;
  v_distinct integer;
begin
  for r in
    select s.id as series_id, s.name as series_name
    from public.series s
  loop
    select count(distinct hb.cover_image_url)
    into v_distinct
    from public.homework_books hb
    where hb.series_id = r.series_id
      and hb.cover_image_url is not null;

    select hb.cover_image_url
    into v_chosen
    from public.homework_books hb
    where hb.series_id = r.series_id
      and hb.cover_image_url is not null
    order by hb.updated_at desc
    limit 1;

    if v_chosen is not null then
      update public.series set cover_image_url = v_chosen where id = r.series_id;
      if v_distinct > 1 then
        raise notice '[series % "%"] cover_image_url conflict (% distinct), picked latest',
          r.series_id, r.series_name, v_distinct;
      end if;
    end if;
  end loop;
end $$;

-- =================================================================
-- 4. 트리거 재선언 — s.total_units 사용
-- =================================================================
create or replace function public.tg_student_homework_book_seed_progress() returns trigger
  language plpgsql
  security definer
  set search_path to 'public'
as $$
declare
  v_total integer;
begin
  select s.total_units into v_total
  from public.class_homework_books chb
    join public.homework_books hb on hb.id = chb.textbook_id
    join public.series s on s.id = hb.series_id
  where chb.id = NEW.class_homework_book_id;

  if v_total is null or v_total <= 0 then
    return NEW;
  end if;

  insert into public.student_homework_progress (
    student_homework_book_id, unit_number, status
  )
  select NEW.id, gs.n, 'pending'
  from generate_series(1, v_total) as gs(n)
  on conflict (student_homework_book_id, unit_number) do nothing;
  return NEW;
end;
$$;

-- =================================================================
-- 5. homework_books 레거시 컬럼 DROP
--    series (text), total_units, cover_image_url
-- =================================================================
alter table public.homework_books drop column if exists series;
alter table public.homework_books drop column if exists total_units;
alter table public.homework_books drop column if exists cover_image_url;

-- =================================================================
-- 6. 코멘트
-- =================================================================
comment on column public.series.total_units is
  '시리즈 단위 총 unit 수. 신규 부여 trigger 가 이 값으로 progress 시드.';
comment on column public.series.cover_image_url is
  '시리즈 단위 표지 이미지 URL (Supabase Storage TEXTBOOK_COVERS 버킷).';

-- =================================================================
-- 검증 쿼리 (참고)
-- =================================================================
-- select count(*) from public.series where total_units <= 0;       -- 0 인 시리즈는 UI 에서 보완
-- select count(*) from public.series where cover_image_url is null; -- 표지 없는 시리즈
