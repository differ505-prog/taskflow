-- =============================================================================
-- Shared Lists RPC v3 — SECURITY DEFINER wrappers for write paths
-- =============================================================================
-- 觸發：
--   截圖「建立共享清單」按鈕後報錯：
--     new row violates row-level security policy for table "shared_lists"
--   根因：現有 RLS policy (sl_write / slm_owner_all / st_write) 用
--         is_list_owner(id, auth.uid()::text) 比對 owner_uid，
--         但在「第一次建立清單」時雞生蛋：owner row 還不存在就被擋。
--
-- 設計：
--   1) 保留原 RLS policy 不動（讓 SELECT 路徑繼續受 RLS 保護）
--   2) 對寫入路徑新增 SECURITY DEFINER RPC wrapper，內部做 caller 校驗
--      （RPC 內檢查 auth.uid() == p_owner_uid 才能寫入）
--   3) client 端改呼叫 RPC 而非直接 from('shared_lists').upsert(...)
--   4) 為什麼用 SECURITY DEFINER 而不是放寬 RLS：
--      - SECURITY DEFINER 把校驗邏輯放在 SQL function 內部，所有 client
--        路徑都必須透過 function；未來新增 client 自動受同一校驗保護
--      - 放寬 RLS 會讓所有 anon key 都能寫入，security model 變弱
--
-- 本次 commit (0019) 範圍：
--   - create_shared_list_v2 : 解決截圖 root cause（owner 建立清單 + 自己 member row）
-- 後續 commit (0020+)：
--   - upsert_shared_tasks_v2 / update_shared_list_v2 / invite_member_v2
--   - remove_member_v2 / change_member_role_v2 / delete_shared_list_v2
-- =============================================================================

-- ── RPC: 建立共享清單（owner 一次性建立 list + 自己 member row）─────────
create or replace function public.create_shared_list_v2(
  p_sid          text,
  p_owner_uid    text,
  p_owner_email  text,
  p_owner_name   text,
  p_name         text,
  p_icon         text,
  p_color        text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_caller_uid text;
begin
  -- 1) 校驗：呼叫者必須是 owner 自己（auth.uid() 必須等於 p_owner_uid）
  v_caller_uid := auth.uid()::text;
  if v_caller_uid is null or v_caller_uid <> p_owner_uid then
    raise exception 'create_shared_list_v2: caller auth.uid() (%) does not match owner_uid (%)',
      v_caller_uid, p_owner_uid
      using errcode = '42501'; -- insufficient_privilege
  end if;

  -- 2) 插入 shared_lists row（若已存在則覆寫）
  insert into public.shared_lists (
    id, owner_uid, owner_email, owner_name, name, icon, color, created_at, updated_at
  ) values (
    p_sid, p_owner_uid, p_owner_email, p_owner_name,
    p_name, coalesce(p_icon, '📋'), coalesce(p_color, '#3B82F6'),
    now(), now()
  )
  on conflict (id) do update set
    owner_uid   = excluded.owner_uid,
    owner_email = excluded.owner_email,
    owner_name  = excluded.owner_name,
    name        = excluded.name,
    icon        = excluded.icon,
    color       = excluded.color,
    updated_at  = now();

  -- 3) 同步 owner 自己的 member row（idempotent：email/uid 對已存在就更新）
  insert into public.shared_list_members (
    shared_list_id, member_uid, member_email, role, status, invited_at, accepted_at
  ) values (
    p_sid, p_owner_uid, lower(coalesce(p_owner_email, '')),
    'owner', 'active', now(), now()
  )
  on conflict (shared_list_id, member_email) do update set
    member_uid  = excluded.member_uid,
    role        = 'owner',
    status      = 'active',
    accepted_at = now();
end;
$$;

revoke all on function public.create_shared_list_v2(text, text, text, text, text, text, text) from public;
grant execute on function public.create_shared_list_v2(text, text, text, text, text, text, text) to anon, authenticated;

-- ── 註解：標記 v2 series RPC 的設計意圖 ──────────────────────────────
comment on function public.create_shared_list_v2(text, text, text, text, text, text, text) is
  'SECURITY DEFINER: 建立共享清單並同步 owner member row。繞過 sl_write / slm_owner_all RLS 避免雞生蛋問題。'
  '呼叫者必須是 owner 本人（auth.uid() == p_owner_uid）。';