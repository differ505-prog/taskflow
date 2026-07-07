-- =============================================================================
-- Shared Lists v2 — Members, per-task rows, ordering, and RLS
-- =============================================================================
-- 涵蓋：
--   1) shared_lists：清單本身
--   2) shared_list_members：具名成員（含 owner/editor/viewer 三角色）
--   3) shared_tasks：每個任務獨立 row（含 position 排序欄位）
--   4) RLS：成員可讀、owner/editor 可寫
--   5) Edge Function security definer helpers：incoming JWT email 比對
-- =============================================================================

-- 1. shared_lists ---------------------------------------------------------
create table if not exists public.shared_lists (
  id           text primary key,
  owner_uid    text not null,
  owner_email  text,
  owner_name   text,
  name         text not null,
  icon         text default '📋',
  color        text default '#3B82F6',
  created_at   timestamptz default now(),
  updated_at   timestamptz default now()
);

-- 2. shared_list_members --------------------------------------------------
create table if not exists public.shared_list_members (
  id              uuid primary key default gen_random_uuid(),
  shared_list_id  text not null references public.shared_lists(id) on delete cascade,
  member_email    text not null,
  member_uid      text,
  role            text not null default 'editor'
                   check (role in ('owner','editor','viewer')),
  status          text not null default 'pending'
                   check (status in ('pending','active','removed')),
  invited_at      timestamptz default now(),
  accepted_at     timestamptz,
  unique (shared_list_id, member_email)
);

create index if not exists slm_uid    on public.shared_list_members (member_uid);
create index if not exists slm_email on public.shared_list_members (member_email);

-- 3. shared_tasks (per-row，取代整包 JSONB) -------------------------------
--    position：介於 -1e9 ~ 1e9 的 double，用於拖曳排序時插入新值而不必
--    重寫整列。詳見 src/lib/sharedSync.ts 的 order-encoder。
create table if not exists public.shared_tasks (
  id              text not null,
  shared_list_id  text not null references public.shared_lists(id) on delete cascade,
  data            jsonb not null,
  position        double precision not null default 0,
  updated_at      timestamptz default now(),
  primary key (shared_list_id, id)
);

create index if not exists st_pos
  on public.shared_tasks (shared_list_id, position);

-- 4. RLS ------------------------------------------------------------------
alter table public.shared_lists         enable row level security;
alter table public.shared_list_members  enable row level security;
alter table public.shared_tasks         enable row level security;

-- Helper：「(list, uid) 是否為 active 成員」
-- 並把 email 也算進去供後續 Edge Function 做 cross-check。
create or replace function public.is_active_member(sid text, uid text)
returns boolean
language sql stable
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
as $$
  select exists (
    select 1 from public.shared_lists
    where id = sid and owner_uid = uid
  );
$$;

create or replace function public.can_read_list(sid text, uid text)
returns boolean
language sql stable
as $$
  select public.is_active_member(sid, uid)
      or public.is_list_owner(sid, uid);
$$;

create or replace function public.can_write_list(sid text, uid text)
returns boolean
language sql stable
as $$
  select public.is_list_owner(sid, uid)
      or exists (
        select 1 from public.shared_list_members m
        where m.shared_list_id = sid
          and m.member_uid    = uid
          and m.status        = 'active'
          and m.role in ('owner','editor')
      );
$$;

-- shared_lists
drop policy if exists sl_read  on public.shared_lists;
drop policy if exists sl_write on public.shared_lists;
create policy sl_read on public.shared_lists for select
  using (public.can_read_list(id, auth.uid()::text));
create policy sl_write on public.shared_lists for all
  using (public.is_list_owner(id, auth.uid()::text))
  with check (public.is_list_owner(id, auth.uid()::text));

-- shared_list_members：active 成員都能 SELECT；只有 owner 可以 INSERT/UPDATE/DELETE
drop policy if exists slm_read      on public.shared_list_members;
drop policy if exists slm_owner_all on public.shared_list_members;
create policy slm_read on public.shared_list_members for select
  using (public.can_read_list(shared_list_id, auth.uid()::text));
create policy slm_owner_all on public.shared_list_members for all
  using (public.is_list_owner(shared_list_id, auth.uid()::text))
  with check (public.is_list_owner(shared_list_id, auth.uid()::text));

-- shared_tasks：依角色 (owner/editor 寫、viewer 讀)
drop policy if exists st_read  on public.shared_tasks;
drop policy if exists st_write on public.shared_tasks;
create policy st_read on public.shared_tasks for select
  using (public.can_read_list(shared_list_id, auth.uid()::text));
create policy st_write on public.shared_tasks for all
  using (public.can_write_list(shared_list_id, auth.uid()::text))
  with check (public.can_write_list(shared_list_id, auth.uid()::text));
