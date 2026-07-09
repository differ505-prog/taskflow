-- =============================================================================
-- personal_lists：個人清單（取代 Firebase Firestore lists collection）
-- =============================================================================

create table if not exists public.personal_lists (
  id          text not null primary key,
  owner_uid   text not null,
  data        jsonb not null,
  created_at  timestamptz default now(),
  updated_at  timestamptz default now()
);

create index if not exists pl_owner_updated on public.personal_lists (owner_uid, updated_at desc);

alter table public.personal_lists enable row level security;

drop policy if exists pl_select_own on public.personal_lists;
create policy pl_select_own on public.personal_lists for select
  using (auth.uid()::text = owner_uid);

drop policy if exists pl_insert_own on public.personal_lists;
create policy pl_insert_own on public.personal_lists for insert
  with check (auth.uid()::text = owner_uid);

drop policy if exists pl_update_own on public.personal_lists;
create policy pl_update_own on public.personal_lists for update
  using (auth.uid()::text = owner_uid)
  with check (auth.uid()::text = owner_uid);

drop policy if exists pl_delete_own on public.personal_lists;
create policy pl_delete_own on public.personal_lists for delete
  using (auth.uid()::text = owner_uid);

alter publication supabase_realtime add table public.personal_lists;