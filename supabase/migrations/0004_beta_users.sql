-- =============================================================================
-- beta_users：Beta 用戶名單（取代 Firebase Realtime Database）
-- =============================================================================
-- 功能：
--   - 儲存所有已登入的 Beta 用戶 Email
--   - Realtime subscription 讓所有已登入客戶端即時同步名單
--   - 未在名單中者顯示 Beta 付費牆（已由 client 端控制）
-- =============================================================================

-- 1. 建立表格
create table if not exists public.beta_users (
  email     text not null primary key,
  added_at  timestamptz default now(),
  added_by  text
);

-- 索引：常用查詢加速
create index if not exists bu_added_at on public.beta_users (added_at);

-- 2. 啟用 RLS
alter table public.beta_users enable row level security;

-- 3. RLS 策略
--    - 所有已登入用戶都能讀取完整名單（客戶端需知道誰有 Beta 權限）
drop policy if exists bu_read_all on public.beta_users;
create policy bu_read_all on public.beta_users for select to authenticated using (true);

--    - 只有 Admin 可以新增/刪除（目前由 client 端控制，future 可加 RPC 驗證）
drop policy if exists bu_insert on public.beta_users;
create policy bu_insert on public.beta_users for insert to authenticated with check (true);

drop policy if exists bu_delete on public.beta_users;
create policy bu_delete on public.beta_users for delete to authenticated using (true);

-- 4. Realtime：啟用 beta_users 表的 Realtime 功能
--    (在 Supabase Dashboard → Database → Replication 也可開啟)
alter publication supabase_realtime add table public.beta_users;
