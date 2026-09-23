-- =============================================================================
-- 0025_quota_counters：Gemini / Resend 用量監控 table
--
-- 用途：每 service 每日期一個 count 列，由 quota-monitor.ts 讀寫
-- 公測期 Gemini (50K/day) / Resend (90/day) 警戒線
--
-- 2026-09-23
-- =============================================================================

create table if not exists public.quota_counters (
  service text not null,
  date    text not null,  -- "YYYY-MM-DD"
  count   integer not null default 0,
  primary key (service, date)
);

alter table public.quota_counters enable row level security;

-- 僅 server-side service role 可寫
drop policy if exists qc_write on public.quota_counters;
create policy qc_write on public.quota_counters for insert
  to authenticated
  with check (false);  -- 禁止 client 直接寫入，service role 繞過 RLS
