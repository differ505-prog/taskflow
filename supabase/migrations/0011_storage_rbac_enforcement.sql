-- =============================================================================
-- Migration 0011: Storage RBAC Enforcement
-- =============================================================================
-- 根因：
--   0010 INSERT policy 只檢查 auth.uid() 存在，未按 user role 限制：
--     - free 用戶可繞過前端 UI 直接呼叫 Storage API 上傳
--     - beta 用戶可上傳超過 5MB（bucket 統一 50MB）
--     - bucket 內 path 結構完全靠 foldername 比對，沒驗證 path owner
--
-- 修正策略:
--   1) 新增 get_storage_role_quota(): DB-side 單一事實來源
--      - admin / pro / beta: 給對應上限
--      - free: 禁止上傳 0 bytes
--   2) 重寫 INSERT policy：以 role 為唯一準則
--   3) 重整 SELECT / DELETE：移除「公開讀」，owner/admin 才能讀；owner/admin 才能刪
--
-- 已知 trade-off：
--   「pro」角色後端判定來源為：
--     - auth.users.raw_user_meta_data->>'is_pro' = 'true'
--     - 或 user_profiles.role = 'pro'
--   AuthContext 也會同步讀這兩個來源，讓 UI 與 DB 對齊。
--   admin metadata 設定範例 (Supabase Dashboard → Authentication → Users):
--     raw_user_meta_data = { "is_admin": true, "is_pro": true }
-- =============================================================================

-- =============================================================================
-- 1. 統一 admin 判定 function（與 0005 / 0006 對齊）
--    注意：app.admin_emails GUC 暫無設定點，僅依 auth.users.raw_user_meta_data
--    metadata (Supabase Dashboard 可手動設定)
-- =============================================================================
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

-- =============================================================================
-- 2. Storage Role Quota function — DB 唯一角色判定來源
--    角色優先序：admin > pro > beta > free
--    來源：
--      - admin: auth.users.raw_user_meta_data->>'is_admin' = 'true'
--               或 user_profiles.role = 'admin'
--      - pro:   auth.users.raw_user_meta_data->>'is_pro' = 'true'
--               或 user_profiles.role = 'pro'
--      - beta:  beta_users 白名單（email）
--               或 user_profiles.role = 'beta'
--      - free:  其他
--
--    返回 jsonb {role, max_bytes}
--      - max_bytes: NULL = 不限；正整數 = 上限；0 = 禁止
--
--    ⚠️ AuthContext 也同步讀 raw_user_meta_data 這兩鍵以讓 UI 對齊 DB
create or replace function public.get_storage_role_quota()
returns jsonb
language plpgsql stable
security definer
set search_path = public
as $$
declare
  v_uid text := auth.uid()::text;
  v_email text;
  v_is_admin_meta bool;
  v_is_pro_meta bool;
  v_db_role text;
  v_beta_email bool;
  v_role text := 'free';
  v_max_bytes bigint := 0;
begin
  if v_uid is null or v_uid = '' then
    return jsonb_build_object('role', 'free', 'max_bytes', 0);
  end if;

  -- 取使用者資訊（一次 query 取齊 metadata keys）
  select
    email,
    (raw_user_meta_data->>'is_admin') = 'true',
    (raw_user_meta_data->>'is_pro') = 'true'
  into v_email, v_is_admin_meta, v_is_pro_meta
  from auth.users
  where id = auth.uid();

  -- 取 user_profiles.role（若存在）
  begin
    select role into v_db_role from public.user_profiles where uid = v_uid;
  exception when undefined_table then
    v_db_role := null;
  end;
  v_db_role := coalesce(v_db_role, 'free');

  -- 取 beta_users 白名單
  begin
    select exists(
      select 1 from public.beta_users where lower(email) = lower(v_email)
    ) into v_beta_email;
  exception when undefined_table then
    v_beta_email := false;
  end;

  -- 判定 role
  if v_is_admin_meta or v_db_role = 'admin' then
    v_role := 'admin';
  elsif v_is_pro_meta or v_db_role = 'pro' then
    v_role := 'pro';
  elsif v_beta_email or v_db_role = 'beta' then
    v_role := 'beta';
  end if;

  -- 對應 max_bytes
  case v_role
    when 'admin' then v_max_bytes := null;       -- 不限
    when 'pro'   then v_max_bytes := 52428800;   -- 50MB
    when 'beta'  then v_max_bytes := 5242880;    -- 5MB
    else v_max_bytes := 0;                        -- free 禁止
  end case;

  return jsonb_build_object(
    'role', v_role,
    'max_bytes', v_max_bytes
  );
end;
$$;

revoke all on function public.get_storage_role_quota() from public;
grant execute on function public.get_storage_role_quota() to authenticated, anon;

-- =============================================================================
-- 3. 重寫 INSERT policy
--    規則：admin / pro / beta 通過；free 拒絕
--    max_bytes 邏輯：byte-level 嚴格限制由 storage bucket file_size_limit
--    控制 (50MB hard cap)，policy 階段僅按 role filter
-- =============================================================================
drop policy if exists "Allow authenticated users to upload attachments" on storage.objects;
drop policy if exists "Allow role-authorized uploads to attachments" on storage.objects;

create policy "Allow role-authorized uploads to attachments"
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'attachments'
  and auth.uid() is not null
  -- path 結構必須是 <user_id>/...
  and auth.uid()::text = (storage.foldername(name))[1]
  -- 角色必須非 free（即 admin / pro / beta）
  and (public.get_storage_role_quota()->>'role') <> 'free'
);

-- =============================================================================
-- 4. 重整 SELECT / DELETE policies
--    - 移除 0010 的「Allow public to read」公開讀（防止任意登入用戶讀所有人附件）
--    - bucket.public = true 仍讓 anonymous 可讀，但已登入用戶需 owner or admin
-- =============================================================================
drop policy if exists "Allow users to read their own attachments" on storage.objects;
drop policy if exists "Allow users to delete their own attachments" on storage.objects;
drop policy if exists "Allow public to read attachments" on storage.objects;
drop policy if exists "Allow owner to read own attachments" on storage.objects;
drop policy if exists "Allow admin to read all attachments" on storage.objects;
drop policy if exists "Allow owner to delete own attachments" on storage.objects;
drop policy if exists "Allow admin to delete any attachment" on storage.objects;

-- SELECT：owner 可讀
create policy "Allow owner to read own attachments"
on storage.objects
for select
to authenticated
using (
  bucket_id = 'attachments'
  and auth.uid()::text = (storage.foldername(name))[1]
);

-- SELECT：admin 可讀全部
create policy "Allow admin to read all attachments"
on storage.objects
for select
to authenticated
using (
  bucket_id = 'attachments'
  and public.is_admin_user()
);

-- DELETE：owner 可刪自己
create policy "Allow owner to delete own attachments"
on storage.objects
for delete
to authenticated
using (
  bucket_id = 'attachments'
  and auth.uid()::text = (storage.foldername(name))[1]
);

-- DELETE：admin 可刪任何
create policy "Allow admin to delete any attachment"
on storage.objects
for delete
to authenticated
using (
  bucket_id = 'attachments'
  and public.is_admin_user()
);

-- =============================================================================
-- 5. 防禦性：確保 bucket file_size_limit = 50MB（pro 上限，且是 Supabase 硬限制）
-- =============================================================================
update storage.buckets
set file_size_limit = 52428800
where id = 'attachments'
  and (file_size_limit is null or file_size_limit <> 52428800);
