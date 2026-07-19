-- =============================================================================
-- 補齊 realtime publication + user profile role 函式
-- 觸發原因：console 看到 3 個錯誤：
--   1. upsert_profile 400        → 可能 0006 migration 未跑，舊版函式簽章不匹配
--   2. get_user_role 404         → 0006 未跑，函式根本不存在
--   3. postgres_changes not allowed → personal_tasks / personal_lists / shared_*
--                                     / beta_users 從未加入 supabase_realtime publication
--
-- 本 migration 全部使用 IF NOT EXISTS / OR REPLACE 守護，**idempotent**：
--   - 已跑過 0006：所有函式已存在，僅補齊 realtime
--   - 未跑過 0006：本次補齊函式 + realtime
--   - 已啟用 realtime：if not exists 略過，無副作用
-- =============================================================================

-- 1. realtime publication：補齊所有需要 realtime 推播的表
do $$
begin
  -- personal_tasks（個人任務）
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and tablename = 'personal_tasks'
  ) then
    alter publication supabase_realtime add table public.personal_tasks;
  end if;

  -- personal_lists（個人清單）
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and tablename = 'personal_lists'
  ) then
    alter publication supabase_realtime add table public.personal_lists;
  end if;

  -- shared_lists（共享清單）
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and tablename = 'shared_lists'
  ) then
    alter publication supabase_realtime add table public.shared_lists;
  end if;

  -- shared_tasks（共享任務）
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and tablename = 'shared_tasks'
  ) then
    alter publication supabase_realtime add table public.shared_tasks;
  end if;

  -- shared_list_members（共享成員）
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and tablename = 'shared_list_members'
  ) then
    alter publication supabase_realtime add table public.shared_list_members;
  end if;

  -- beta_users（beta 名單）
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and tablename = 'beta_users'
  ) then
    alter publication supabase_realtime add table public.beta_users;
  end if;
end $$;

-- 2. user_profiles.role 欄位（若 0006 未跑則補上）
do $$
begin
  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public'
      and table_name = 'user_profiles'
      and column_name = 'role'
  ) then
    alter table public.user_profiles
      add column role text not null default 'free'
      check (role in ('free', 'beta', 'admin'));
  end if;
end $$;

-- 3. upsert_profile（最新版本，與 0006 簽章一致；若已存在則 or replace 覆寫）
create or replace function public.upsert_profile(
  p_uid          text,
  p_email        text,
  p_display_name text default null,
  p_avatar_url   text default null
)
returns public.user_profiles
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid          uuid;
  v_is_admin     boolean;
  v_role         text;
  v_display_name text;
  v_avatar_url   text;
  v_row          public.user_profiles;
begin
  begin
    v_uid := p_uid::uuid;
  exception when others then
    raise exception 'invalid p_uid: %', p_uid;
  end;

  -- 讀取 is_admin metadata（來自 ADMIN_EMAILS 流程或手動設定）
  select coalesce(
    (select (raw_user_meta_data->>'is_admin')::boolean from auth.users where id = v_uid),
    false
  ) into v_is_admin;

  v_role := case when v_is_admin then 'admin' else 'free' end;
  v_display_name := coalesce(p_display_name, split_part(p_email, '@', 1));
  v_avatar_url   := p_avatar_url;

  insert into public.user_profiles (uid, email, display_name, avatar_url, role)
  values (v_uid, p_email, v_display_name, v_avatar_url, v_role)
  on conflict (uid) do update set
    email        = excluded.email,
    display_name = excluded.display_name,
    avatar_url   = excluded.avatar_url,
    role         = excluded.role,
    updated_at   = now()
  returning * into v_row;

  return v_row;
end $$;

revoke all on function public.upsert_profile(text, text, text, text) from public;
grant execute on function public.upsert_profile(text, text, text, text) to anon, authenticated;

-- 4. get_user_role（最新版本；若已存在則 or replace 覆寫）
create or replace function public.get_user_role(p_uid text)
returns text
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_uid  uuid;
  v_role text;
begin
  begin
    v_uid := p_uid::uuid;
  exception when others then
    return 'free';
  end;

  select role into v_role
  from public.user_profiles
  where uid = v_uid;

  return coalesce(v_role, 'free');
end $$;

revoke all on function public.get_user_role(text) from public;
grant execute on function public.get_user_role(text) to authenticated;

-- 5. RLS：確保 anon/authenticated 可呼叫上述函式（若 0006 已設則 noop）
-- （略過細部 policy，本檔專注 realtime + 函式存在性；policy 由各自表 migration 控管）
