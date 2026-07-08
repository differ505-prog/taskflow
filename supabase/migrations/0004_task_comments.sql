-- =============================================================================
-- task_comments：任務評論資料表（從 Firebase Firestore 遷移到 Supabase）
-- =============================================================================
-- 功能：
--   - task_id：所屬任務 ID
--   - content：純文字內容（500 字上限）
--   - author_uid：留言者 Supabase Auth UID
--   - author_email：留言者 email（便於顯示匿名化版本）
--   - created_at：留言時間
--   - RLS：使用者只能讀取/刪除自己建立的評論
-- =============================================================================

-- 1. 建立表格
create table if not exists public.task_comments (
  id          text not null primary key,
  task_id     text not null,
  content     text not null check (char_length(content) <= 500),
  author_uid  text not null,
  author_email text not null,
  created_at  timestamptz not null default now()
);

-- 索引：依任務查詢評論
create index if not exists tc_task_id     on public.task_comments (task_id);
create index if not exists tc_author_uid on public.task_comments (author_uid);
create index if not exists tc_created   on public.task_comments (created_at);

-- 2. 啟用 RLS
alter table public.task_comments enable row level security;

-- 3. RLS 策略
--    - 所有人都能讀所有評論（允許在同一任務協作時看到彼此的進度回報）
drop policy if exists tc_read on public.task_comments;
create policy tc_read on public.task_comments for select using (true);

--    - 已登入使用者可以新增評論
drop policy if exists tc_insert on public.task_comments;
create policy tc_insert on public.task_comments for insert
  with check (auth.uid()::text = author_uid);

--    - 只能刪除自己的評論
drop policy if exists tc_delete on public.task_comments;
create policy tc_delete on public.task_comments for delete
  using (auth.uid()::text = author_uid);
