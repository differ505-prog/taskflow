-- =============================================================================
-- user_profiles：Supabase Auth 使用者資料表（取代 Firebase Firestore）
-- =============================================================================
-- 功能：
--   - last_login_at：每次登入時更新
--   - last_active_at：完成任務 / 建立任務等有意義動作時更新
--   - created_at：帳號建立時間
--   - display_name：從 OAuth metadata 同步而來
--   - role：未來可擴充（目前由前端 ADMIN_EMAILS + Firebase betaList 共同判定）
-- =============================================================================

-- 1. 建立表格
create table if not exists public.user_profiles (
  uid           text not null primary key,
  email         text,
  display_name  text,
  avatar_url    text,
  last_login_at timestamptz,
  last_active_at timestamptz,
  created_at    timestamptz default now(),
  updated_at    timestamptz default now()
);

-- 索引：常用查詢加速
create index if not exists up_email on public.user_profiles (email);
create index if not exists up_last_active on public.user_profiles (last_active_at);

-- 2. 啟用 RLS
alter table public.user_profiles enable row level security;

-- 3. Helper：檢查是否為本人
create or replace function public.is_profile_owner(profile_uid text)
returns boolean
language sql stable
security definer
set search_path = public
as $$
  select auth.uid()::text = profile_uid;
$$;

-- 4. Helper：檢查是否為 admin（在 auth.users metadata 中設定）
create or replace function public.is_admin_user()
returns boolean
language sql stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from auth.users
    where id = auth.uid()
      and raw_user_meta_data->>'is_admin' = 'true'
  );
$$;

-- 5. RLS 策略
--    - 所有人都能讀所有 profiles（供邀請成員時查詢 display name）
drop policy if exists up_read_all on public.user_profiles;
create policy up_read_all on public.user_profiles for select
  using (true);

--    - 用戶只能寫入自己的 profile
drop policy if exists up_own_insert on public.user_profiles;
create policy up_own_insert on public.user_profiles for insert
  with check (auth.uid()::text = uid);

drop policy if exists up_own_update on public.user_profiles;
create policy up_own_update on public.user_profiles for update
  using (auth.uid()::text = uid)
  with check (auth.uid()::text = uid);

-- 6. Upsert profile RPC（idempotent，首次登入自動建立，之後更新）
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
begin
  insert into public.user_profiles (uid, email, display_name, avatar_url, last_login_at, last_active_at, created_at, updated_at)
  values (p_uid, p_email, p_display_name, p_avatar_url, now(), now(), now(), now())
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

-- 7. update_last_active RPC（有節流，由 client 控制頻率）
create or replace function public.update_last_active(p_uid text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.user_profiles
     set last_active_at = now(),
         updated_at     = now()
   where uid = p_uid;
end;
$$;

revoke all on function public.update_last_active(text) from public;
grant execute on function public.update_last_active(text) to anon, authenticated;

-- 8. get_profile RPC（供 client 安全讀取自己或其他人的 profile）
create or replace function public.get_profile(p_uid text)
returns public.user_profiles
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row public.user_profiles%rowtype;
begin
  select * into v_row from public.user_profiles where uid = p_uid limit 1;
  return v_row;
end;
$$;

revoke all on function public.get_profile(text) from public;
grant execute on function public.get_profile(text) to anon, authenticated;
