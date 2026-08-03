-- =============================================================================
-- Fix RLS Infinite Recursion
-- =============================================================================
-- 問題：在 0001 的 RLS 政策中，is_active_member 與 is_list_owner 是 language sql 函數，
--       且沒有設定 security definer。當 PostgREST 或其他客戶端對 shared_lists 做 SELECT 時，
--       Planner 會試圖把這些函數 inline 展開。由於它們內部又 SELECT 了相同的資料表，
--       這會導致 Planner 陷入無限展開的迴圈，最終佔用 CPU 直到 timeout。
--       這也是導致 connection pool 耗盡與 API 超時的元兇。
--
-- 解法：將這兩個輔助函數加上 `security definer`。這不僅能防止 Planner inline 它們，
--       同時在執行時會以函數建立者（postgres）身份執行，自動繞過內部的 RLS 檢查，
--       完美切斷無限迴圈的發生。
-- =============================================================================

create or replace function public.is_active_member(sid text, uid text)
returns boolean
language sql stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.shared_list_members
    where shared_list_id = sid
      and member_uid    = uid
      and status        = 'active'
  );
$$;

create or replace function public.is_list_owner(sid text, uid text)
returns boolean
language sql stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.shared_lists
    where id = sid and owner_uid = uid
  );
$$;
