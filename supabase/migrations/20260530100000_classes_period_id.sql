-- classes 에 시작 시간 (period_id) FK 추가 + 백필.
-- 유치부 → 1st Period 자동, 오후반 → 이름 파싱 (days_of_week + period_id), 방과후 → NULL.
set search_path = public;

-- 1) FK 컬럼 추가
alter table public.classes
  add column if not exists period_id uuid references public.academy_periods(id)
    on delete set null;
create index if not exists idx_classes_period_id on public.classes(period_id);

-- 2) 유치부 → 1st Period 일괄 할당
update public.classes c
set period_id = ap.id,
    updated_at = now()
from public.academy_periods ap
where c.group_type = 'kindergarten'
  and ap.group_type = 'kindergarten'
  and ap.name = '1st Period'
  and c.period_id is distinct from ap.id;

-- 3) 오후반 이름 파싱 — days_of_week + period_id 백필
do $$
declare
  r record;
  v_days_token text;
  v_time_token text;
  v_period_id uuid;
  v_days int[];
  i int;
  ch text;
  next_ch text;
  v_parse_ok boolean;
begin
  for r in
    select id, name from public.classes where group_type = 'afternoon'
  loop
    v_days_token := null;
    v_time_token := null;
    v_period_id := null;
    v_days := null;
    v_parse_ok := false;

    -- 형식: "이름1/이름2_요일토큰_시간토큰"
    if r.name ~ '^[^/]+/[^_]+_[MTWhF]+_[0-9]+:[0-9]+$' then
      v_days_token := split_part(split_part(r.name, '_', 2), '_', 1);
      v_time_token := split_part(r.name, '_', 3);
    end if;

    if v_days_token is null or v_time_token is null then
      raise notice '[classes parse skip] id=% name="%" (형식 불일치)', r.id, r.name;
      -- period_id 그대로 두기 (이미 NULL 이거나 admin 이 지정한 값)
      continue;
    end if;

    -- 요일 파싱 (Th 우선, left-to-right)
    v_days := ARRAY[]::int[];
    i := 1;
    v_parse_ok := true;
    while i <= length(v_days_token) loop
      ch := substring(v_days_token from i for 1);
      next_ch := case when i < length(v_days_token) then substring(v_days_token from i+1 for 1) else null end;
      if ch = 'T' and next_ch = 'h' then
        v_days := v_days || 4;
        i := i + 2;
      elsif ch = 'M' then v_days := v_days || 1; i := i + 1;
      elsif ch = 'T' then v_days := v_days || 2; i := i + 1;
      elsif ch = 'W' then v_days := v_days || 3; i := i + 1;
      elsif ch = 'F' then v_days := v_days || 5; i := i + 1;
      else
        raise notice '[classes days parse skip] id=% name="%" unknown_char=%', r.id, r.name, ch;
        v_parse_ok := false;
        exit;
      end if;
    end loop;

    if not v_parse_ok then
      continue;
    end if;

    -- 중복 제거 + 정렬
    select array_agg(distinct d order by d) into v_days from unnest(v_days) as d;

    -- period 매칭
    select id into v_period_id
    from public.academy_periods
    where group_type = 'afternoon' and name = v_time_token
    limit 1;

    if v_period_id is null then
      raise notice '[classes period miss] id=% name="%" time_token="%"', r.id, r.name, v_time_token;
    end if;

    update public.classes
    set days_of_week = v_days,
        period_id = v_period_id,
        updated_at = now()
    where id = r.id;
  end loop;
end $$;

comment on column public.classes.period_id is
  '시작 시간 (academy_periods FK). 유치부=1st Period 고정, 오후반=admin 지정, 방과후=NULL.';
