-- =============================================================================
-- personal_habits：個人習慣（暖身區 / 打卡清單）
-- =============================================================================
-- 與 personal_tasks / personal_lists 對齊：同樣 JSONB 結構、RLS、realtime 廣播
-- 補上 §26-A 樂觀更新保護所需：owner_uid + updated_at + realtime publication
-- =============================================================================

create table if not exists public.personal_habits (
  id          text not null primary key,
  owner_uid   text not null,
  data        jsonb not null,
  is_archived boolean default false,
  created_at  timestamptz default now(),
  updated_at  timestamptz default now()
);

create index if not exists ph_owner_updated on public.personal_habits (owner_uid, updated_at desc);
create index if not exists ph_owner_archived on public.personal_habits (owner_uid, is_archived);

-- 2. 啟用 RLS
alter table public.personal_habits enable row level security;

-- 3. RLS 策略：只能讀寫自己的
drop policy if exists ph_select_own on public.personal_habits;
create policy ph_select_own on public.personal_habits for select
  using (auth.uid()::text = owner_uid);

drop policy if exists ph_insert_own on public.personal_habits;
create policy ph_insert_own on public.personal_habits for insert
  with check (auth.uid()::text = owner_uid);

drop policy if exists ph_update_own on public.personal_habits;
create policy ph_update_own on public.personal_habits for update
  using (auth.uid()::text = owner_uid)
  with check (auth.uid()::text = owner_uid);

drop policy if exists ph_delete_own on public.personal_habits;
create policy ph_delete_own on public.personal_habits for delete
  using (auth.uid()::text = owner_uid);

-- 4. Realtime 廣播
alter publication supabase_realtime add table public.personal_habits;