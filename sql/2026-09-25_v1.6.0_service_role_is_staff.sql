-- App v1.6.0 — APPLIED to the live database on 2026-09-25 (migration v1_5_2_service_role_is_staff).
-- The Cloud Run server calls Supabase with the SERVICE ROLE key, which has no auth.uid(),
-- so v1.5.0 treated it as anonymous: LINE account linking was silently ignored and
-- LINE delivery notifications never found the customer's line_user_id.
create or replace function public.loyalty_role(p_phone text, p_token uuid)
returns text language sql stable security definer set search_path to 'public','pg_temp' as $$
  select case
    when auth.uid() is not null then 'staff'
    when coalesce(auth.jwt()->>'role','') = 'service_role' then 'staff'
    when p_token is not null and exists (
      select 1 from public.customers c
      where c.phone = btrim(p_phone) and c.session_token = p_token
        and (c.session_expires is null or c.session_expires > now())) then 'owner'
    else 'none' end;
$$;
revoke execute on function public.loyalty_role(text, uuid) from anon, authenticated, public;
