-- =============================================================================
-- user_profiles Role 補充 Migration
-- =============================================================================
-- 目標：
--   1) user_profiles 加入 role 欄位
--   2) 新增 set_user_role RPC（admin 專用，設定任意用戶角色）
--   3) upsert_profile 自動根據 ADMIN_EMAILS 或 auth.users is_admin metadata
--      設定正確的 role
--   4) 建立輔助 function：is_super_admin / get_user_role
--
-- 注意：
--   - ADMIN_EMAILS 由 Supabase Dashboard → Authentication → Users → User Metadata
--     對應使用者的 raw_user_meta_data 設定 { "is_admin": true }
--   - 若 auth.users.raw_user_meta_data->>'is_admin' = 'true' → 該用戶為 admin
--   - 否則根據 EMAIL 在 ADMIN_EMAILS 環境變數比對
--   - 未在任何名單 → role = 'free'
-- =============================================================================

-- 1. 加入 role 欄位（預設 'free'）
alter table public.user_profiles
  add column if not exists role text not null default 'free'
  check (role in ('admin', 'beta', 'free'));

-- 重新賦予 RLS check constraint（alter table 後有時會 drop）
alter table public.user_profiles
  drop constraint if exists user_profiles_role_check;
alter table public.user_profiles
  add constraint user_profiles_role_check
  check (role in ('admin', 'beta', 'free'));

-- 索引
create index if not exists up_role on public.user_profiles (role);

-- 2. Helper：判斷是否超級管理員
--    - auth.users raw_user_meta_data->>'is_admin' = 'true'
--    - 或 email 在 ADMIN_EMAILS 環境變數中
create or replace function public.is_super_admin()
returns boolean
language plpgsql stable security definer
set search_path = public
set app.admin_emails = current_setting('app.admin_emails', true)
as $$
declare
  v_email text;
  v_is_admin_meta bool;
  v_admin_list text;
begin
  if auth.uid() is null then return false; end if;

  select
    email,
    (raw_user_meta_data->>'is_admin') = 'true'
  into v_email, v_is_admin_meta
  from auth.users
  where id = auth.uid();

  if v_is_admin_meta then return true; end if;

  v_admin_list := current_setting('app.admin_emails', true);
  if v_admin_list = '' or v_email is null then return false; end if;

  return lower(v_email) = any(
    array(select trim(lower(unnest(string_to_array(v_admin_list, ',')))))
  );
end;
$$;

-- 3. 重新實作 upsert_profile：自動計算 role（使用 is_super_admin 統一路由）
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
  v_role text;
  v_is_admin bool;
begin
  -- 計算 role
  if public.is_super_admin() then
    v_role := 'admin';
  else
    v_role := 'free'; -- beta 由 set_user_role RPC 手動設定
  end if;

  insert into public.user_profiles
    (uid, email, display_name, avatar_url, role, last_login_at, last_active_at, created_at, updated_at)
  values
    (p_uid, p_email, p_display_name, p_avatar_url, v_role, now(), now(), now(), now())
  on conflict (uid) do update set
    email          = coalesce(p_email,       user_profiles.email),
    display_name   = coalesce(p_display_name, user_profiles.display_name),
    avatar_url     = coalesce(p_avatar_url,   user_profiles.avatar_url),
    last_login_at  = now(),
    updated_at     = now()
  returning *;
end;
$$;

revoke all on function public.upsert_profile(text, text, text, text) from public;
grant execute on function public.upsert_profile(text, text, text, text) to anon, authenticated;

-- 5. set_user_role RPC：admin 可將任意用戶設為 beta 或 free
create or replace function public.set_user_role(p_uid text, p_role text)
returns public.user_profiles
language plpgsql
security definer
set search_path = public
set app.admin_emails = current_setting('app.admin_emails', true)
as $$
begin
  if not public.is_super_admin() then
    raise exception 'Unauthorized: admin only';
  end if;

  if p_role not in ('admin', 'beta', 'free') then
    raise exception 'Invalid role: must be admin, beta, or free';
  end if;

  update public.user_profiles
     set role       = p_role,
         updated_at = now()
   where uid = p_uid;

  return (select * from public.user_profiles where uid = p_uid);
end;
$$;

revoke all on function public.set_user_role(text, text) from public;
grant execute on function public.set_user_role(text, text) to authenticated;

-- 6. get_user_role RPC：任何人可查自己的 role
create or replace function public.get_user_role(p_uid text)
returns text
language plpgsql stable security definer
set search_path = public
as $$
declare
  v_role text;
begin
  select role into v_role
  from public.user_profiles
  where uid = p_uid;
  return coalesce(v_role, 'free');
end;
$$;

revoke all on function public.get_user_role(text) from public;
grant execute on function public.get_user_role(text) to authenticated;

-- 7. 更新既有記錄的 role
--    （新 column 後已有 default 'free'，但要修正已有 ADMIN metadata 的 admin）
do $$
declare
  v_admin_uid text;
begin
  for v_admin_uid in
    select id::text from auth.users
    where raw_user_meta_data->>'is_admin' = 'true'
  loop
    update public.user_profiles set role = 'admin', updated_at = now()
    where uid = v_admin_uid;
  end loop;
end;
$$;
