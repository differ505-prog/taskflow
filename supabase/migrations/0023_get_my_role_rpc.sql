-- ── RPC: 取得自己在清單中的角色 (Bypass RLS) ──────────────────────
create or replace function public.get_my_role_v2(p_sid text)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_caller_uid text;
  v_role text;
  v_owner_uid text;
begin
  v_caller_uid := auth.uid()::text;
  if v_caller_uid is null then
    return null;
  end if;

  -- 先查 shared_list_members
  select role into v_role
  from public.shared_list_members
  where shared_list_id = p_sid
    and member_uid = v_caller_uid
    and status = 'active'
  limit 1;

  if v_role is not null then
    return v_role;
  end if;

  -- 沒找到就看是不是 owner
  select owner_uid into v_owner_uid
  from public.shared_lists
  where id = p_sid;

  if v_owner_uid = v_caller_uid then
    return 'owner';
  end if;

  return null;
end;
$$;
