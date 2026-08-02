-- =============================================================================
-- Shared Lists RPC v3 (writes) — 補齊剩餘寫入路徑的 SECURITY DEFINER wrappers
-- =============================================================================
-- 觸發：migration 0019 只解決「第一次建立清單」(create_shared_list_v2)
--       其他 5 個寫入路徑仍走 client 直接 from('table').upsert/update/delete，
--       撞相同 RLS 雞生蛋問題：
--         - invite_member_v2       撞 slm_owner_all
--         - remove_member_v2       撞 slm_owner_all
--         - change_member_role_v2  撞 slm_owner_all
--         - upsert_shared_tasks_v2 撞 st_write
--         - delete_shared_list_v2  撞 sl_write (list_owner only)
--
-- 設計原則同 0019：SECURITY DEFINER 繞過 RLS + function 內部做 caller 校驗。
--
-- caller 校驗策略：
--   - invite / remove / changeMemberRole：要求 caller auth.uid() == list.owner_uid
--   - upsertSharedTasks：要求 caller auth.uid() == list.owner_uid OR 是 active editor member
--   - deleteSharedList：要求 caller auth.uid() == list.owner_uid（只有 owner 能刪整個清單）
-- =============================================================================

-- ── Helper: 取得 list 的 owner_uid（SECURITY DEFINER 內可讀，安全） ──
create or replace function public._get_list_owner(sid text)
returns text
language sql stable
security definer
set search_path = public
as $$
  select owner_uid from public.shared_lists where id = sid;
$$;
revoke all on function public._get_list_owner(text) from public;
grant execute on function public._get_list_owner(text) to anon, authenticated;

-- ── Helper: caller 是否為 active editor 或以上（owner/editor/viewer） ──
create or replace function public._can_write_tasks(sid text, caller_uid text)
returns boolean
language sql stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.shared_list_members
    where shared_list_id = sid
      and member_uid    = caller_uid
      and status        = 'active'
      and role in ('owner','editor')
  ) or exists (
    select 1 from public.shared_lists where id = sid and owner_uid = caller_uid
  );
$$;
revoke all on function public._can_write_tasks(text, text) from public;
grant execute on function public._can_write_tasks(text, text) to anon, authenticated;

-- ── RPC: 邀請成員（owner only）──────────────────────────────────────
create or replace function public.invite_member_v2(
  p_sid         text,
  p_member_email text,
  p_role        text
)
returns public.shared_list_members
language plpgsql
security definer
set search_path = public
as $$
declare
  v_caller_uid text;
  v_owner_uid  text;
  v_row        public.shared_list_members%rowtype;
begin
  v_caller_uid := auth.uid()::text;
  if v_caller_uid is null then
    raise exception 'invite_member_v2: not authenticated'
      using errcode = '42501';
  end if;

  v_owner_uid := public._get_list_owner(p_sid);
  if v_owner_uid is null then
    raise exception 'invite_member_v2: list % not found', p_sid
      using errcode = 'P0002';
  end if;
  if v_owner_uid <> v_caller_uid then
    raise exception 'invite_member_v2: only owner can invite (caller=%, owner=%)',
      v_caller_uid, v_owner_uid
      using errcode = '42501';
  end if;

  if p_role not in ('editor','viewer') then
    raise exception 'invite_member_v2: invalid role % (must be editor or viewer)', p_role
      using errcode = '22023';
  end if;

  insert into public.shared_list_members (
    shared_list_id, member_email, role, status, invited_at
  ) values (
    p_sid, lower(p_member_email), p_role, 'pending', now()
  )
  on conflict (shared_list_id, member_email) do update set
    role        = excluded.role,
    status      = 'pending',
    invited_at  = now(),
    member_uid  = null,
    accepted_at = null
  returning * into v_row;

  return v_row;
end;
$$;
revoke all on function public.invite_member_v2(text, text, text) from public;
grant execute on function public.invite_member_v2(text, text, text) to anon, authenticated;

-- ── RPC: 移除成員（owner only，軟刪除）─────────────────────────────
create or replace function public.remove_member_v2(
  p_sid          text,
  p_member_email text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_caller_uid text;
  v_owner_uid  text;
begin
  v_caller_uid := auth.uid()::text;
  if v_caller_uid is null then
    raise exception 'remove_member_v2: not authenticated'
      using errcode = '42501';
  end if;
  v_owner_uid := public._get_list_owner(p_sid);
  if v_owner_uid is null or v_owner_uid <> v_caller_uid then
    raise exception 'remove_member_v2: only owner can remove'
      using errcode = '42501';
  end if;

  -- 不允許 owner 把自己的 member row 移除（會破壞 owner 唯一性）
  if lower(p_member_email) = (
    select lower(member_email) from public.shared_list_members
    where shared_list_id = p_sid and role = 'owner' and status = 'active'
    limit 1
  ) then
    raise exception 'remove_member_v2: cannot remove the owner'
      using errcode = '22023';
  end if;

  update public.shared_list_members
     set status = 'removed'
   where shared_list_id = p_sid
     and lower(member_email) = lower(p_member_email);
end;
$$;
revoke all on function public.remove_member_v2(text, text) from public;
grant execute on function public.remove_member_v2(text, text) to anon, authenticated;

-- ── RPC: 變更成員角色（owner only）─────────────────────────────────
create or replace function public.change_member_role_v2(
  p_sid          text,
  p_member_email text,
  p_role         text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_caller_uid text;
  v_owner_uid  text;
begin
  v_caller_uid := auth.uid()::text;
  if v_caller_uid is null then
    raise exception 'change_member_role_v2: not authenticated'
      using errcode = '42501';
  end if;
  v_owner_uid := public._get_list_owner(p_sid);
  if v_owner_uid is null or v_owner_uid <> v_caller_uid then
    raise exception 'change_member_role_v2: only owner can change roles'
      using errcode = '42501';
  end if;

  if p_role not in ('owner','editor','viewer') then
    raise exception 'change_member_role_v2: invalid role %', p_role
      using errcode = '22023';
  end if;

  -- 不允許把 owner 降級
  if lower(p_member_email) = (
    select lower(member_email) from public.shared_list_members
    where shared_list_id = p_sid and role = 'owner' and status = 'active'
    limit 1
  ) then
    raise exception 'change_member_role_v2: cannot demote the owner'
      using errcode = '22023';
  end if;

  update public.shared_list_members
     set role = p_role
   where shared_list_id = p_sid
     and lower(member_email) = lower(p_member_email)
     and status = 'active';
end;
$$;
revoke all on function public.change_member_role_v2(text, text, text) from public;
grant execute on function public.change_member_role_v2(text, text, text) to anon, authenticated;

-- ── RPC: 寫入/更新任務（owner 或 active editor）──────────────────────
create or replace function public.upsert_shared_tasks_v2(
  p_sid   text,
  p_tasks jsonb   -- array of { id: text, data: jsonb, position: number }
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_caller_uid text;
  v_owner_uid  text;
  v_task       jsonb;
  v_id         text;
  v_position   double precision;
begin
  v_caller_uid := auth.uid()::text;
  if v_caller_uid is null then
    raise exception 'upsert_shared_tasks_v2: not authenticated'
      using errcode = '42501';
  end if;

  if not public._can_write_tasks(p_sid, v_caller_uid) then
    raise exception 'upsert_shared_tasks_v2: caller (%) cannot write to list %',
      v_caller_uid, p_sid
      using errcode = '42501';
  end if;

  if jsonb_typeof(p_tasks) <> 'array' then
    raise exception 'upsert_shared_tasks_v2: p_tasks must be a jsonb array'
      using errcode = '22023';
  end if;

  for v_task in select * from jsonb_array_elements(p_tasks)
  loop
    v_id       := v_task->>'id';
    v_position := (v_task->>'position')::double precision;
    if v_id is null then
      raise exception 'upsert_shared_tasks_v2: task missing id'
        using errcode = '22023';
    end if;

    insert into public.shared_tasks (id, shared_list_id, data, position, updated_at)
    values (v_id, p_sid, v_task->'data', v_position, now())
    on conflict (shared_list_id, id) do update set
      data       = excluded.data,
      position   = excluded.position,
      updated_at = now();
  end loop;
end;
$$;
revoke all on function public.upsert_shared_tasks_v2(text, jsonb) from public;
grant execute on function public.upsert_shared_tasks_v2(text, jsonb) to anon, authenticated;

-- ── RPC: 設定任務 position（owner 或 active editor）─────────────────
create or replace function public.set_shared_task_position_v2(
  p_sid      text,
  p_task_id  text,
  p_position double precision
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_caller_uid text;
begin
  v_caller_uid := auth.uid()::text;
  if v_caller_uid is null then
    raise exception 'set_shared_task_position_v2: not authenticated'
      using errcode = '42501';
  end if;

  if not public._can_write_tasks(p_sid, v_caller_uid) then
    raise exception 'set_shared_task_position_v2: caller (%) cannot write to list %',
      v_caller_uid, p_sid
      using errcode = '42501';
  end if;

  update public.shared_tasks
     set position   = p_position,
         updated_at = now()
   where shared_list_id = p_sid and id = p_task_id;
end;
$$;
revoke all on function public.set_shared_task_position_v2(text, text, double precision) from public;
grant execute on function public.set_shared_task_position_v2(text, text, double precision) to anon, authenticated;

-- ── RPC: 刪除任務（owner 或 active editor）─────────────────────────
create or replace function public.delete_shared_task_v2(
  p_sid     text,
  p_task_id text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_caller_uid text;
begin
  v_caller_uid := auth.uid()::text;
  if v_caller_uid is null then
    raise exception 'delete_shared_task_v2: not authenticated'
      using errcode = '42501';
  end if;

  if not public._can_write_tasks(p_sid, v_caller_uid) then
    raise exception 'delete_shared_task_v2: caller (%) cannot write to list %',
      v_caller_uid, p_sid
      using errcode = '42501';
  end if;

  delete from public.shared_tasks
   where shared_list_id = p_sid and id = p_task_id;
end;
$$;
revoke all on function public.delete_shared_task_v2(text, text) from public;
grant execute on function public.delete_shared_task_v2(text, text) to anon, authenticated;

-- ── RPC: 刪除整個清單（owner only，cascade 自動清 tasks/members）─────
create or replace function public.delete_shared_list_v2(
  p_sid text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_caller_uid text;
  v_owner_uid  text;
begin
  v_caller_uid := auth.uid()::text;
  if v_caller_uid is null then
    raise exception 'delete_shared_list_v2: not authenticated'
      using errcode = '42501';
  end if;
  v_owner_uid := public._get_list_owner(p_sid);
  if v_owner_uid is null or v_owner_uid <> v_caller_uid then
    raise exception 'delete_shared_list_v2: only owner can delete list'
      using errcode = '42501';
  end if;

  delete from public.shared_lists where id = p_sid;
  -- tasks / members 由 FK cascade 自動刪除
end;
$$;
revoke all on function public.delete_shared_list_v2(text) from public;
grant execute on function public.delete_shared_list_v2(text) to anon, authenticated;

-- ── 註解：標記每個 function 的設計意圖 ──────────────────────────────
comment on function public.invite_member_v2(text, text, text) is
  'SECURITY DEFINER: owner 邀請成員。繞過 slm_owner_all RLS。caller 必須是 list owner。';
comment on function public.remove_member_v2(text, text) is
  'SECURITY DEFINER: owner 移除成員（軟刪除 status=removed）。繞過 slm_owner_all RLS。';
comment on function public.change_member_role_v2(text, text, text) is
  'SECURITY DEFINER: owner 變更成員角色。繞過 slm_owner_all RLS。不可降級 owner。';
comment on function public.upsert_shared_tasks_v2(text, jsonb) is
  'SECURITY DEFINER: 寫入/更新 shared_tasks。繞過 st_write RLS。owner 或 active editor 可呼叫。';
comment on function public.set_shared_task_position_v2(text, text, double precision) is
  'SECURITY DEFINER: 拖曳排序更新 position。繞過 st_write RLS。owner 或 active editor 可呼叫。';
comment on function public.delete_shared_task_v2(text, text) is
  'SECURITY DEFINER: 刪除單個 shared_task。繞過 st_write RLS。owner 或 active editor 可呼叫。';
comment on function public.delete_shared_list_v2(text) is
  'SECURITY DEFINER: 刪除整個 shared_list。繞過 sl_write RLS。只有 owner 能呼叫。';
comment on function public._get_list_owner(text) is
  'INTERNAL: 讀取 list 的 owner_uid。給 SECURITY DEFINER function 內部使用。';
comment on function public._can_write_tasks(text, text) is
  'INTERNAL: 判斷 caller 是否能寫入 list 的 task（owner 或 active editor）。';