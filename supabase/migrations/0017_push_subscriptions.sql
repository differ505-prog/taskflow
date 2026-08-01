-- =============================================================================
-- push_subscriptions / notification_log / fan_out_queue
-- 跨裝置原生推播（Web Push via VAPID）
-- =============================================================================
-- 對應功能：使用者按鈕 → pushManager.subscribe() → 訂閱存這張表
-- backend 推播時：撈該 user 的所有訂閱 → fan-out → 透過 web-push library 推
-- 防重複：notification_log 用 (task_id, subscription_id) 去重，3 秒內同任務不重發
-- =============================================================================

-- 1. 訂閱表：每個裝置一列，同 user 可多列（手機 + 電腦 + iPad）
create table if not exists public.push_subscriptions (
  id                  text not null primary key,
  owner_uid           text not null,
  endpoint            text not null unique,
  p256dh              text not null,
  auth                text not null,
  user_agent          text,
  device_label        text,                     -- 給設定頁 UI 顯示 ("iPhone Safari")
  is_active           boolean default true,
  last_seen_at        timestamptz default now(),
  created_at          timestamptz default now(),
  updated_at          timestamptz default now()
);

create index if not exists ps_owner_active on public.push_subscriptions (owner_uid, is_active);
create index if not exists ps_endpoint on public.push_subscriptions (endpoint);

-- 2. 推播歷史：防重複推、debug、統計送達率
create table if not exists public.notification_log (
  id                  text not null primary key,
  owner_uid           text not null,
  subscription_id     text references public.push_subscriptions(id) on delete cascade,
  task_id             text,
  title               text not null,
  body                text,
  url                 text,
  status              text not null default 'pending',  -- pending | sent | failed | expired
  sent_at             timestamptz,
  error_message       text,
  created_at          timestamptz default now()
);

create index if not exists nl_owner_created on public.notification_log (owner_uid, created_at desc);
create index if not exists nl_subscription on public.notification_log (subscription_id);
create index if not exists nl_task on public.notification_log (task_id);
create index if not exists nl_status on public.notification_log (status);

-- 3. Fan-out queue：Vercel Cron 寫入待發送任務，backend 排程撈
create table if not exists public.fan_out_queue (
  id                  text not null primary key,
  owner_uid           text not null,
  task_id             text not null,
  trigger_type        text not null,  -- 'due_time' | 'task_created' | 'task_updated'
  scheduled_for       timestamptz not null,  -- Cron 用這個時間決定何時送
  payload             jsonb not null,
  processed_at        timestamptz,
  created_at          timestamptz default now()
);

create index if not exists foq_pending on public.fan_out_queue (scheduled_for) where processed_at is null;
create index if not exists foq_owner on public.fan_out_queue (owner_uid);

-- 4. RLS：只能讀寫自己的訂閱 / log / queue
alter table public.push_subscriptions enable row level security;
alter table public.notification_log enable row level security;
alter table public.fan_out_queue enable row level security;

drop policy if exists ps_select_own on public.push_subscriptions;
create policy ps_select_own on public.push_subscriptions for select
  using (auth.uid()::text = owner_uid);

drop policy if exists ps_insert_own on public.push_subscriptions;
create policy ps_insert_own on public.push_subscriptions for insert
  with check (auth.uid()::text = owner_uid);

drop policy if exists ps_update_own on public.push_subscriptions;
create policy ps_update_own on public.push_subscriptions for update
  using (auth.uid()::text = owner_uid);

drop policy if exists ps_delete_own on public.push_subscriptions;
create policy ps_delete_own on public.push_subscriptions for delete
  using (auth.uid()::text = owner_uid);

drop policy if exists nl_select_own on public.notification_log;
create policy nl_select_own on public.notification_log for select
  using (auth.uid()::text = owner_uid);

drop policy if exists nl_insert_own on public.notification_log;
create policy nl_insert_own on public.notification_log for insert
  with check (auth.uid()::text = owner_uid);

-- fan_out_queue 只讓 backend service role 寫，前端只能讀自己的
drop policy if exists foq_select_own on public.fan_out_queue;
create policy foq_select_own on public.fan_out_queue for select
  using (auth.uid()::text = owner_uid);

-- 5. Realtime 廣播：訂閱新增/移除時通知前端
alter publication supabase_realtime add table public.push_subscriptions;

-- 6. updated_at trigger
drop trigger if exists trg_ps_updated on public.push_subscriptions;
create trigger trg_ps_updated before update on public.push_subscriptions
  for each row execute function public.set_updated_at();
