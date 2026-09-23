-- =============================================================================
-- 0024_personal_data_size_constraint：防止 jsonb 欄位 DoS 攻擊
--
-- 根因：personal_tasks.data 與 personal_lists.data 沒有大小約束，
-- 惡意用戶可繞過 client 端 maxLength={200} 直接 POST 巨大 JSONB
-- 把資料庫撐爆或造成查詢效能問題。
--
-- 2026-09-23
-- =============================================================================

-- 1. personal_tasks：每列 octet_length 上限 16KB
alter table public.personal_tasks
  add constraint pt_data_size_limit
  check (octet_length(data::text) <= 16384);

-- 2. personal_lists：每列 octet_length 上限 4KB
alter table public.personal_lists
  add constraint pl_data_size_limit
  check (octet_length(data::text) <= 4096);

-- 3. Task payload 細粒度約束 trigger
create or replace function public.validate_task_payload()
returns trigger
language plpgsql
as $$
begin
  -- title 上限 500 字（char_length 對 UTF-8 更準確）
  if char_length(NEW.data->>'title') > 500 then
    raise exception 'Task title too long (max 500 chars)';
  end if;

  -- description 上限 10000 字
  if char_length(coalesce(NEW.data->>'description', '')) > 10000 then
    raise exception 'Task description too long (max 10000 chars)';
  end if;

  -- tags 上限 20 個
  if jsonb_array_length(coalesce(NEW.data->'tags', '[]'::jsonb)) > 20 then
    raise exception 'Too many tags (max 20)';
  end if;

  -- subTasks 上限 50 個
  if jsonb_array_length(coalesce(NEW.data->'subTasks', '[]'::jsonb)) > 50 then
    raise exception 'Too many subTasks (max 50)';
  end if;

  return new;
end;
$$;

drop trigger if exists trg_validate_task_payload on public.personal_tasks;
create trigger trg_validate_task_payload
  before insert or update on public.personal_tasks
  for each row execute function public.validate_task_payload();

-- 4. 警告既有超限資料（若無超限則 silent）
do $$
declare
  v_count integer;
begin
  -- 檢查是否有 task 超限（> 16KB）
  select count(*) into v_count
    from public.personal_tasks
   where octet_length(data::text) > 16384;
  if v_count > 0 then
    raise warning 'Found % personal_tasks exceeding 16KB; please clean before applying constraint', v_count;
  end if;

  -- 檢查是否有 list 超限（> 4KB）
  select count(*) into v_count
    from public.personal_lists
   where octet_length(data::text) > 4096;
  if v_count > 0 then
    raise warning 'Found % personal_lists exceeding 4KB; please clean before applying constraint', v_count;
  end if;
end;
$$;
