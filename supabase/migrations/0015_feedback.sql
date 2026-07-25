-- =============================================================================
-- 0015_feedback.sql — 封測/公測反饋收集表
--
-- 設計動機:
--   封測 / 公測期需要 0 摩擦收集用戶反饋(§1 摩擦最小化)。
--   配合 FeedbackButton(浮動按鈕) + FeedbackModal(自動預填 metadata),
--   使用者只需「可選打字」一鍵送出。Discord webhook 同步通知開發者。
--
-- 欄位設計:
--   - user_id:鑑別送出者(可為 null,允許訪客模式)
--   - user_email / user_role:便於開發者分類(若登入)
--   - message:使用者打字內容(可空,單純「按了沒反應」也算反饋)
--   - context:JSONB,自動打包的 metadata(route / app_version / console_errors / actions)
--   - status:new / reviewed / archived / spurious,給開發者後台用
--   - category:由 AI 整理時填入(目前為 null,留給後續 LLM 整理流程)
--   - created_at:時序
--
-- 資安(§8):
--   - RLS 啟用,authenticated 只能 SELECT 自己的反饋
--   - INSERT 對 authenticated 開放(本人寫入)
--   - SELECT / UPDATE 對 admin 開放(透過 is_admin() 函式)
--   - anon 不允許(避免垃圾訊息)
-- =============================================================================

-- 1. feedback 表
create table if not exists public.feedback (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete set null,
  user_email text,
  user_role text,
  message text not null default '',
  context jsonb not null default '{}'::jsonb,
  status text not null default 'new'
    check (status in ('new', 'reviewed', 'archived', 'spurious')),
  category text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- 索引:給開發者後台分組查詢
create index if not exists feedback_created_at_idx
  on public.feedback (created_at desc);
create index if not exists feedback_status_idx
  on public.feedback (status);
create index if not exists feedback_user_id_idx
  on public.feedback (user_id);
create index if not exists feedback_user_role_idx
  on public.feedback (user_role);

-- 2. is_admin() 函式:若 0011 / 0006 已有則 noop
create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    (select (raw_user_meta_data->>'is_admin')::boolean from auth.users where id = auth.uid()),
    false
  );
$$;

grant execute on function public.is_admin() to authenticated;

-- 3. RLS
alter table public.feedback enable row level security;

-- 3a. authenticated 可 INSERT 自己的反饋
drop policy if exists feedback_insert_own on public.feedback;
create policy feedback_insert_own on public.feedback
  for insert
  to authenticated
  with check (auth.uid() = user_id);

-- 3b. authenticated 可 SELECT 自己的反饋(讓用戶能看到自己送過的)
drop policy if exists feedback_select_own on public.feedback;
create policy feedback_select_own on public.feedback
  for select
  to authenticated
  using (auth.uid() = user_id);

-- 3c. admin 可 SELECT 全部
drop policy if exists feedback_select_admin on public.feedback;
create policy feedback_select_admin on public.feedback
  for select
  to authenticated
  using (public.is_admin());

-- 3d. admin 可 UPDATE(標記 reviewed / archived / spurious)
drop policy if exists feedback_update_admin on public.feedback;
create policy feedback_update_admin on public.feedback
  for update
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

-- 4. realtime publication:讓 admin 後台可即時看到新反饋
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and tablename = 'feedback'
  ) then
    alter publication supabase_realtime add table public.feedback;
  end if;
end $$;

-- 5. updated_at 自動維護
create or replace function public.touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists feedback_touch_updated_at on public.feedback;
create trigger feedback_touch_updated_at
  before update on public.feedback
  for each row execute function public.touch_updated_at();
