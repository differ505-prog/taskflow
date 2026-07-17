-- =============================================================================
-- Migration 0012: task_comments RLS 強化
-- =============================================================================
-- 根因：
--   0004 的 tc_read policy 為「using (true)」，任何 anon / authenticated 用戶
--   都能 SELECT * FROM public.task_comments，讀取所有用戶的 email 與留言內容。
--   即使前端 UI 只顯示某個 task_id 的評論，DB 層無任何限制。
--
--   攻擊面：
--     - 任何持有 anon key 的人可全表 SELECT（洩漏 author_uid / author_email）
--     - 透過 API 拼湊出用戶活動模式（哪些任務有留言、頻率）
--
-- 修正策略:
--   重寫 tc_read 為「必須是相關人士」：
--     1) 作者本人永遠可讀自己
--     2) 個人任務擁有者可讀評論（personal_tasks.owner_uid = auth.uid）
--     3) 共享清單成員可讀評論（shared_list_members.member_uid = auth.uid）
--     4) 共享清單 owner 可讀評論
--     5) admin 旁路
--
-- 不改動 tc_insert / tc_delete（既有政策已合理）：
--   - INSERT: with check (auth.uid()::text = author_uid) ✅
--   - DELETE: using (auth.uid()::text = author_uid) ✅
--
-- 已知 trade-off：
--   - 每次 SELECT 會觸發三個 EXISTS 子查詢（personal_tasks / shared_tasks
--     / shared_list_members），但都有 pk 索引，成本可接受
--   - 如果日後 task_comments 增加 list_id 欄位，可改用更直接的 join
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. 重寫 SELECT policy
-- -----------------------------------------------------------------------------
drop policy if exists tc_read on public.task_comments;

create policy tc_read on public.task_comments for select
to authenticated
using (
  -- 1) 作者本人
  auth.uid()::text = author_uid
  -- 2) 個人任務 owner
  or exists (
    select 1 from public.personal_tasks pt
    where pt.id = task_comments.task_id
      and pt.owner_uid = auth.uid()::text
  )
  -- 3) 共享清單成員（active 狀態）
  or exists (
    select 1 from public.shared_tasks st
    join public.shared_list_members m on m.shared_list_id = st.shared_list_id
    where st.id = task_comments.task_id
      and m.member_uid = auth.uid()::text
      and m.status = 'active'
  )
  -- 4) 共享清單 owner
  or exists (
    select 1 from public.shared_tasks st
    join public.shared_lists sl on sl.id = st.shared_list_id
    where st.id = task_comments.task_id
      and sl.owner_uid = auth.uid()::text
  )
  -- 5) admin 旁路
  or public.is_admin_user()
);

-- -----------------------------------------------------------------------------
-- 2. 防禦性：拒絕 anon 對 task_comments 的所有操作
--    即使有「公開讀」的舊政策殘留，anon 也無權讀
--    （保留 anon grant 為 0，policy 涵蓋所有 operation）
-- -----------------------------------------------------------------------------
revoke all on public.task_comments from anon;

-- -----------------------------------------------------------------------------
-- 3. 索引優化：task_id 已有索引（tc_task_id），sub-query 走 pk 即可
--    為 shared_tasks.id / personal_tasks.id 確認 pk 存在
--    （前者已有 shared_list_id + id 複合 pk；後者 id 為單欄 pk）
--    不需額外索引。
-- =============================================================================