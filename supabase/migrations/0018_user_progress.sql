-- =============================================================================
-- user_progress：Pro 等級進度的 Supabase 同步表（取代 localStorage）
-- =============================================================================
-- 功能：
--   - total_pp：使用者累積的 Productivity Points（單一維度，6 等級制）
--   - updated_at：最後寫入時間（realtime 廣播會附帶）
--
-- 為什麼獨立成表（不併入 user_profiles）：
--   - 等級計算是「寫入頻繁」的即時資料，realtime 訂閱粒度更細
--   - user_profiles 屬於「使用者基本資料」，語意不同
--   - RLS 規則單純（只需本人讀寫），不混入顯示名稱/頭像策略
--
-- 觸發：useProgressStatus 從 localStorage 改為讀寫此表
--       對應 src/lib/progressRankSync.ts
-- =============================================================================

-- 1. 建立表格
create table if not exists public.user_progress (
  owner_uid  text not null primary key,
  total_pp   integer not null default 0 check (total_pp >= 0),
  updated_at timestamptz not null default now()
);

-- 2. 啟用 RLS
alter table public.user_progress enable row level security;

-- 3. Helper：本人判斷（與 user_profiles 共用相同 auth pattern）
--    內聯表達式即可，不需要另開函式

-- 4. RLS 策略：用戶只能讀寫自己的進度
drop policy if exists upg_read_own on public.user_progress;
create policy upg_read_own on public.user_progress for select
  using (auth.uid()::text = owner_uid);

drop policy if exists upg_insert_own on public.user_progress;
create policy upg_insert_own on public.user_progress for insert
  with check (auth.uid()::text = owner_uid);

drop policy if exists upg_update_own on public.user_progress;
create policy upg_update_own on public.user_progress for update
  using (auth.uid()::text = owner_uid)
  with check (auth.uid()::text = owner_uid);

-- 5. Realtime 廣播設定（讓其他裝置能訂閱 total_pp 變更）
alter publication supabase_realtime add table public.user_progress;

-- 6. 註解
comment on table public.user_progress is 'Pro 等級進度（total_pp）；client 端從 localStorage 改為此表';
comment on column public.user_progress.total_pp is '累積 Productivity Points（純函式 calculateProgressLevel 計算等級）';