-- Force recreate get_user_role to clear PostgREST schema cache
drop function if exists public.get_user_role(text);

create or replace function public.get_user_role(p_uid text)
returns text
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_uid  uuid;
  v_role text;
begin
  begin
    v_uid := p_uid::uuid;
  exception when others then
    return 'free';
  end;

  select role into v_role
  from public.user_profiles
  where uid = v_uid;

  return coalesce(v_role, 'free');
end $$;

grant execute on function public.get_user_role(text) to anon, authenticated;
