-- =============================================================================
-- shared_invites：一次性邀請 token 系統
--
-- 用途：
--   - Owner 邀請他人時，系統自動生成 UUID token 並寄 email
--   - 對方點連結 → /invite/{token} → Server-side 驗證 + 加入成員
--   - 不依賴 client 端 email 比對，任何 OAuth 帳號都能加入
--
-- Security：
--   - token 一次性UUID，猜測不可能
--   - 有 7 天期限，逾期自動失效
--   - email 必須對上（避免被惡意塞進別人 email）
--   - 只能被使用一次（used_at 非 null 後失效）
-- =============================================================================

-- ── 1. shared_invites table ─────────────────────────────────────────────────
create table if not exists public.shared_invites (
  id              uuid primary key default gen_random_uuid(),
  token           text not null unique,
  shared_list_id  text not null references public.shared_lists(id) on delete cascade,
  invitee_email   text not null,
  inviter_uid     text not null,
  inviter_name    text,
  role            text not null default 'editor'
                   check (role in ('owner','editor','viewer')),
  expires_at      timestamptz not null default (now() + interval '7 days'),
  used_at         timestamptz,
  created_at      timestamptz default now()
);

create index if not exists si_token     on public.shared_invites (token);
create index if not exists si_email     on public.shared_invites (invitee_email);
create index if not exists si_list      on public.shared_invites (shared_list_id);

-- ── 2. RLS ──────────────────────────────────────────────────────────────────
alter table public.shared_invites enable row level security;

-- 所有人都能讀取自己的邀請（用於 /invite/[token] 頁面顯示清單名稱）
-- 注意：invitee_email 會在 API 層比對當前登入者的 email
create policy si_read_by_invitee on public.shared_invites for select
  using (invitee_email = lower(current_setting('app.current_email', true)));

-- Owner 可以管理自己的邀請
create policy si_owner_all on public.shared_invites for all
  using (inviter_uid = auth.uid()::text)
  with check (inviter_uid = auth.uid()::text);

-- Service role 可以寫入（accept invite API 需要）
-- grant 在 migration 末尾統一處理

-- ── 3. Grants ─────────────────────────────────────────────────────────────
-- 允許 service_role 對 shared_invites 的所有操作
-- anon/authenticated 需要讀取自己的邀請（info API 用 service_role 查）
grant select on table public.shared_invites to anon, authenticated;
grant all on table public.shared_invites to service_role;
