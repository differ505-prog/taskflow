-- =============================================================================
-- storage_attachments_bucket：建立 attachments bucket 並設定大小限制
-- =============================================================================
-- 症狀：上傳檔案時 Supabase Storage 回 400 Bad Request（所有檔案皆壞）。
-- 根因：storage.buckets 表裡沒有 'attachments' 這個 bucket row，
--       Supabase Storage 對任何寫入到未註冊 bucket 的請求直接拒絕。
-- 修正：在 storage.buckets 表 INSERT 一筆 attachments bucket（public），
--       file_size_limit 設為 50 MB。
--       使用 ON CONFLICT DO NOTHING 確保 idempotent 可重跑。
-- =============================================================================

-- 1. 建立 attachments bucket（若已存在則 noop）
insert into storage.buckets (id, name, public, file_size_limit)
values ('attachments', 'attachments', true, 52428800)
on conflict (id) do nothing;

-- 2. 保險起見：若 bucket 已存在但 file_size_limit 不是 50 MB，強制設為 50 MB
update storage.buckets
set file_size_limit = 52428800
where id = 'attachments'
  and (file_size_limit is null or file_size_limit <> 52428800);

-- 3. 驗證用 SELECT（執行後可在 Results 看到 1 row）
-- select id, name, public, file_size_limit from storage.buckets where id = 'attachments';