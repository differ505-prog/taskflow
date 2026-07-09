-- =============================================================================
-- personal_tasks：個人任務（取代 Firebase Firestore tasks collection）
-- =============================================================================
-- 設計：
--   - 一列一筆任務，整個 Task 物件存到 data jsonb 欄位
--   - owner_uid 為 Supabase Auth uid，RLS 限定只能讀寫自己的
--   - updated_at desc 索引加速 Realtime 排序
-- =============================================================================

create table if not exists public.personal_tasks (
  id          text not null primary key,
  owner_uid   text not null,
  data        jsonb not null,
  is_archived boolean default false,
  created_at  timestamptz default now(),
  updated_at  timestamptz default now()
);

create index if not exists pt_owner_updated on public.personal_tasks (owner_uid, updated_at desc);
create index if not exists pt_owner_archived on public.personal_tasks (owner_uid, is_archived);

-- 2. 啟用 RLS
alter table public.personal_tasks enable row level security;

-- 3. RLS 策略：只能讀寫自己的
drop policy if exists pt_select_own on public.personal_tasks;
create policy pt_select_own on public.personal_tasks for select
  using (auth.uid()::text = owner_uid);

drop policy if exists pt_insert_own on public.personal_tasks;
create policy pt_insert_own on public.personal_tasks for insert
  with check (auth.uid()::text = owner_uid);

drop policy if exists pt_update_own on public.personal_tasks;
create policy pt_update_own on public.personal_tasks for update
  using (auth.uid()::text = owner_uid)
  with check (auth.uid()::text = owner_uid);

drop policy if exists pt_delete_own on public.personal_tasks;
create policy pt_delete_own on public.personal_tasks for delete
  using (auth.uid()::text = owner_uid);

-- 4. Realtime 廣播
alter publication supabase_realtime add table public.personal_tasks;