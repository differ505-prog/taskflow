-- =============================================================================
-- 啟用 task_comments 的 Realtime 推播
-- 沒有這行，postgres_changes 訂閱收不到事件，前端不會自動更新
-- =============================================================================

do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and tablename = 'task_comments'
  ) then
    alter publication supabase_realtime add table public.task_comments;
  end if;
end $$;