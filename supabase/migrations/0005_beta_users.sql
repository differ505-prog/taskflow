-- =============================================================================
-- beta_users：Beta 測試者白名單（從 Firebase Firestore 遷移到 Supabase）
-- =============================================================================
-- 功能：
--   - email：統一手機大小寫儲存（小寫）
--   - added_by：開通者的 Supabase Auth UID
--   - added_at：開通時間
--   - RLS：任何已登入者可讀，admin 才能新增/刪除
--
-- Admin 判定：auth.users.raw_user_meta_data->>'is_admin' = 'true'
--   需在 Supabase Dashboard → Authentication → Users → User Metadata
--   手動設定 { "is_admin": true }
-- =============================================================================

-- 1. 建立表格
create table if not exists public.beta_users (
  email     text not null primary key,
  added_by  text not null,
  added_at  timestamptz not null default now()
);

-- 索引
create index if not exists bu_added_at on public.beta_users (added_at);

-- 2. 啟用 RLS
alter table public.beta_users enable row level security;

-- 3. Helper：檢查是否為 admin
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

-- 4. RLS 策略
--    - 所有已登入者可讀取名單（便於前端即時判定 role）
drop policy if exists bu_read_all on public.beta_users;
create policy bu_read_all on public.beta_users for select
  using (auth.role() = 'authenticated');

--    - 僅 admin 可新增
drop policy if exists bu_insert_admin on public.beta_users;
create policy bu_insert_admin on public.beta_users for insert
  with check (public.is_admin_user());

--    - 僅 admin 可刪除
drop policy if exists bu_delete_admin on public.beta_users;
create policy bu_delete_admin on public.beta_users for delete
  using (public.is_admin_user());

-- 5. RPC：新增 Beta 用戶（security definer 繞過 RLS）
create or replace function public.add_beta_user(p_email text)
returns public.beta_users
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.beta_users (email, added_by)
  values (lower(trim(p_email)), auth.uid()::text)
  on conflict (email) do nothing;
  return (select * from public.beta_users where email = lower(trim(p_email)));
end;
$$;

revoke all on function public.add_beta_user(text) from public;
grant execute on function public.add_beta_user(text) to authenticated;

-- 6. RPC：移除 Beta 用戶（security definer 繞過 RLS）
create or replace function public.remove_beta_user(p_email text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  delete from public.beta_users where email = lower(trim(p_email));
end;
$$;

revoke all on function public.remove_beta_user(text) from public;
grant execute on function public.remove_beta_user(text) to authenticated;
