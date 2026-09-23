-- =============================================================================
-- 0026_rate_limit_buckets：分散式 Rate Limit 表 + RPC
--
-- 根因：所有 API route 用 new Map() in-memory 做 rate limit，
--       Vercel serverless 每個請求可能分發到不同 instance，
--       rate limit counter 不共享，攻擊者可打不同 cold instance bypass。
--
-- 修正：Supabase 作為單一事實來源，pg_advisory_lock 保证原子性。
--
-- 2026-09-23
-- =============================================================================

-- 1. rate_limit_buckets 表
create table if not exists public.rate_limit_buckets (
  key         text primary key,
  count       bigint not null default 0,
  reset_at    timestamptz not null,
  created_at  timestamptz default now()
);

-- 2. 快速清理過期 bucket（每天一次，防止 table 膨脹）
create or replace function public.cleanup_rate_limit_buckets()
returns void language plpgsql security definer as $$
begin
  delete from public.rate_limit_buckets
   where reset_at < now() - interval '2 days';
end;
$$;

-- 3. RPC: 原子遞增 + 窗口重置（使用 advisory lock 防 race condition）
create or replace function public.rate_limit_increment(
  p_key         text,
  p_limit       bigint,
  p_window_sec  bigint
) returns jsonb language plpgsql security definer as $$
declare
  v_count   bigint;
  v_reset   timestamptz;
  v_allowed bool;
  v_rem     bigint;
  v_lock    bigint;
begin
  -- 取 hash 作 advisory lock key（避免跨 key 衝突）
  v_lock := hashtext(p_key);

  perform pg_advisory_xact_lock(v_lock);

  select count, reset_at into v_count, v_reset
    from public.rate_limit_buckets
   where key = p_key
  for update;

  if v_reset is null or v_reset < now() then
    v_count := 0;
    v_reset := now() + (p_window_sec || ' seconds')::interval;
  end if;

  if v_count >= p_limit then
    v_allowed := false;
    v_rem := 0;
  else
    v_count := v_count + 1;
    v_allowed := true;
    v_rem := p_limit - v_count;
  end if;

  insert into public.rate_limit_buckets (key, count, reset_at)
  values (p_key, v_count, v_reset)
  on conflict (key) do update
    set count = v_count, reset_at = v_reset;

  return jsonb_build_object(
    'allowed',   v_allowed,
    'remaining', v_rem,
    'reset_at',  v_reset
  );
end;
$$;

-- 4. 權限
revoke all on function public.rate_limit_increment(text,bigint,bigint) from public;
grant execute on function public.rate_limit_increment(text,bigint,bigint) to authenticated, anon;
