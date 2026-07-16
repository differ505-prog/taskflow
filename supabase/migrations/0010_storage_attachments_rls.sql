-- Migration 0010: 為 attachments bucket 加 RLS policies
-- 根因: storage.objects 表沒 INSERT/SELECT policy,
--       所以任何 authenticated user 寫入都被 403 "new row violates row-level security policy"

-- 1. 允許 authenticated users 上傳到 attachments bucket
--    (只要 auth.uid() 不為空,folder 名是 user UUID 即可)
CREATE POLICY "Allow authenticated users to upload attachments"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'attachments'
  AND auth.uid() IS NOT NULL
);

-- 2. 允許 owner 讀取自己 user folder 下的附件
--    (path 結構: <user_id>/<filename>)
CREATE POLICY "Allow users to read their own attachments"
ON storage.objects
FOR SELECT
TO authenticated
USING (
  bucket_id = 'attachments'
  AND auth.uid()::text = (storage.foldername(name))[1]
);

-- 3. 允許 owner 刪除自己 user folder 下的附件
CREATE POLICY "Allow users to delete their own attachments"
ON storage.objects
FOR DELETE
TO authenticated
USING (
  bucket_id = 'attachments'
  AND auth.uid()::text = (storage.foldername(name))[1]
);

-- 4. 公開讀取(bucket 是 public,所有人都能讀)
CREATE POLICY "Allow public to read attachments"
ON storage.objects
FOR SELECT
TO public
USING (bucket_id = 'attachments');