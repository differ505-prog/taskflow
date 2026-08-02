-- =============================================================================
-- acceptance RPC：將 email 比對邏輯放在後端，避免惡意綁 UID
-- =============================================================================
-- 流程：
--   client 呼叫 public.accept_invite(p_sid text, p_uid text, p_email text)
--   1) 找出 sid 對應的 pending member row，且 row.member_email = p_email
--   2) 若找到，update member_uid = p_uid, status = 'active', accepted_at = now()
--   3) 否則 raise exception
--
-- Security model（2026-08-03 修憲後）：
--   - Auth 用 Supabase Auth（OAuth + email），不再用 Firebase ID token
--   - Function 套用 SECURITY DEFINER 並 set search_path = public，
--     讓 SQL 內部可以繞過 RLS 直接 update
--   - email 比對在 SQL 內部執行，client 端的 callerEmail 不可信
-- =============================================================================

create or replace function public.accept_invite(
  p_sid text,
  p_uid  text,
  p_email text
)
returns public.shared_list_members
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row public.shared_list_members%rowtype;
begin
  -- 1) 確認這份邀請是發給這個 email 的（email 比對不可缺）
  select * into v_row
  from public.shared_list_members
  where shared_list_id = p_sid
    and status        = 'pending'
    and lower(member_email) = lower(p_email)
  for update;

  if not found then
    raise exception 'No pending invite for this list & email'
      using errcode = 'P0002';
  end if;

  -- 2) 補釘 uid、狀態變 active
  update public.shared_list_members
     set member_uid  = p_uid,
         status      = 'active',
         accepted_at = now()
   where id = v_row.id
   returning * into v_row;

  return v_row;
end;
$$;

revoke all on function public.accept_invite(text, text, text) from public;
grant execute on function public.accept_invite(text, text, text) to anon, authenticated;
