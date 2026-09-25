-- App v1.6.0 — APPLIED to the live database on 2026-09-25 (migration v1_5_1_guest_pickup_edit_key).
-- 1) Guest orders get a secret "edit key" so the browser that placed the order (and only it)
--    can switch it to pickup. Guests have no phone, so the v1.5.0 phone check always blocked them.
-- 2) Anonymous callers can no longer overwrite another customer's saved addresses via loyalty_update
--    (the orders trigger already records delivery addresses).

begin;

alter table public.orders add column if not exists edit_key text;

-- track_orders returns "setof orders", so it must list the new column too (always null: never expose the key)
create or replace function public.track_orders(p_ids text[], p_phone text default null)
returns setof orders language sql stable security definer set search_path to 'public','pg_temp' as $$
  select o.id, o.customer_name,
         case when auth.uid() is not null or (p_phone is not null and btrim(p_phone)=o.customer_phone) then o.customer_phone
              else regexp_replace(coalesce(o.customer_phone,''), '^(\d{3})\d+(\d{2})$', '\1xxxxx\2') end,
         o.type, o.source, o.status, o.total_amount, o.net_amount, o.created_at, o.note,
         case when auth.uid() is not null or (p_phone is not null and btrim(p_phone)=o.customer_phone) then o.delivery_address
              else left(coalesce(o.delivery_address,''), 25) || case when length(coalesce(o.delivery_address,''))>25 then '…' else '' end end,
         o.delivery_zone, o.delivery_fee, o.payment_method, o.pickup_time, o.table_number, o.items,
         o.dropoff_lat, o.dropoff_lng, o.delivery_lat, o.delivery_lng, o.delivery_type, o.delivery_status,
         o.lalamove_quotation_id, o.lalamove_order_id, o.lalamove_share_link, o.rating, o.comment,
         o.delivery_vehicle, o.scheduled_at, null::numeric, null::jsonb, o.stock_deducted,
         null::text
  from public.orders o
  where (o.id = any(coalesce(p_ids, array[]::text[])) and (auth.uid() is not null or o.created_at > now() - interval '3 days'))
     or (p_phone is not null and btrim(p_phone) <> '' and o.customer_phone = btrim(p_phone)
         and o.created_at > now() - interval '2 days')
  order by o.created_at desc
  limit 50;
$$;

-- customer_update_order: also accept the order's edit key (p_key) instead of the phone
drop function if exists public.customer_update_order(text, jsonb, text);
create or replace function public.customer_update_order(p_id text, p jsonb, p_phone text default null, p_key text default null)
returns void language plpgsql security definer set search_path to 'public','pg_temp' as $$
declare o public.orders; v_ok boolean;
begin
  if p_id is null or btrim(p_id) = '' then raise exception 'order id required'; end if;
  select * into o from public.orders where id = p_id;
  if not found then return; end if;

  if (p ? 'rating') or (p ? 'comment') then
    update public.orders set
      rating  = case when p ? 'rating'  then nullif(p->>'rating','')::integer else rating end,
      comment = case when p ? 'comment' then p->>'comment' else comment end
    where id = p_id;
  end if;

  if (p->>'to_pickup') = 'true' or (p ? 'items') then
    v_ok := auth.uid() is not null
         or (p_phone is not null and btrim(p_phone) <> '' and btrim(p_phone) = btrim(coalesce(o.customer_phone,'')))
         or (p_key is not null and length(p_key) >= 20 and o.edit_key is not null and p_key = o.edit_key);
    if not v_ok then raise exception 'PHONE_MISMATCH'; end if;
    if auth.uid() is null and o.created_at < now() - interval '2 hours' then
      raise exception 'ORDER_TOO_OLD';
    end if;
    update public.orders set
      type         = case when (p->>'to_pickup') = 'true' then 'pickup' else type end,
      delivery_fee = case when (p->>'to_pickup') = 'true' then 0 else delivery_fee end,
      items        = case when p ? 'items' then p->'items' else items end,
      total_amount = case when p ? 'total_amount' then nullif(p->>'total_amount','')::numeric else total_amount end,
      net_amount   = case when p ? 'net_amount' then nullif(p->>'net_amount','')::numeric else net_amount end,
      note         = case when p ? 'note' then p->>'note' else note end
    where id = p_id and status not in ('completed','cancelled');
  end if;
end $$;
grant execute on function public.customer_update_order(text,jsonb,text,text) to anon, authenticated;

-- loyalty_update: saved_addresses only for staff or the logged-in owner
create or replace function public.loyalty_update(p_phone text, p jsonb, p_token uuid default null)
returns void language plpgsql security definer set search_path to 'public','pg_temp' as $$
declare r text := public.loyalty_role(p_phone, p_token); c public.customers;
begin
  select * into c from public.customers where phone = btrim(p_phone);
  if not found then return; end if;
  update public.customers set
    loyalty_points  = case when p ? 'loyalty_points' and (r='staff' or (r='owner' and nullif(p->>'loyalty_points','')::numeric <= c.loyalty_points))
                           then nullif(p->>'loyalty_points','')::numeric else c.loyalty_points end,
    tier            = case when p ? 'tier' and r='staff' then p->>'tier' else c.tier end,
    order_history   = case when p ? 'order_history' and r='staff' then p->'order_history' else c.order_history end,
    coupons         = case when p ? 'coupons' and (r<>'none' or public.coupons_used_only(c.coupons, p->'coupons')) then p->'coupons' else c.coupons end,
    saved_favorites = case when p ? 'saved_favorites' and r<>'none' then p->'saved_favorites' else c.saved_favorites end,
    saved_addresses = case when p ? 'saved_addresses' and r<>'none' then p->'saved_addresses' else c.saved_addresses end,
    line_user_id    = case when p ? 'line_user_id' and r='staff' then nullif(p->>'line_user_id','') else c.line_user_id end
  where phone = btrim(p_phone);
end $$;

commit;
