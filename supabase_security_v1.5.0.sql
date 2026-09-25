-- v1.5.0 security migration — ALREADY APPLIED to the live database (matches it as of 2026-09-25).
-- Kept for the record. Differs from the copy in the old pizza-damac-security-patch.zip:
-- loyalty_login / loyalty_lookup return two extra null columns (session_token, session_expires),
-- because `returns setof customers` must list every column of the customers table.

-- ===== Session token for customers =====
alter table public.customers add column if not exists session_token uuid;
alter table public.customers add column if not exists session_expires timestamptz;

-- who is calling?  'staff' = signed-in Supabase Auth user, 'owner' = valid customer token, 'none' = anonymous
create or replace function public.loyalty_role(p_phone text, p_token uuid)
returns text language sql stable security definer set search_path to 'public','pg_temp' as $$
  select case
    when auth.uid() is not null then 'staff'
    when p_token is not null and exists (
      select 1 from public.customers c
      where c.phone = btrim(p_phone) and c.session_token = p_token
        and (c.session_expires is null or c.session_expires > now())) then 'owner'
    else 'none' end;
$$;
revoke execute on function public.loyalty_role(text, uuid) from anon, authenticated, public;

-- coupons may only change from "not used" to "used"; no new coupons, no un-using
create or replace function public.coupons_used_only(p_old jsonb, p_new jsonb)
returns boolean language sql immutable as $$
  select coalesce(p_old,'[]'::jsonb) = '[]'::jsonb and coalesce(p_new,'[]'::jsonb) = '[]'::jsonb
      or (
        jsonb_typeof(p_old)='array' and jsonb_typeof(p_new)='array'
        and jsonb_array_length(p_old) = jsonb_array_length(p_new)
        and not exists (
          select 1 from jsonb_array_elements(p_new) with ordinality n(v,i)
          join jsonb_array_elements(p_old) with ordinality o(v,i) on o.i = n.i
          where (n.v - 'isUsed') <> (o.v - 'isUsed')
             or (coalesce((o.v->>'isUsed')::boolean,false) and not coalesce((n.v->>'isUsed')::boolean,false))
        ));
$$;
revoke execute on function public.coupons_used_only(jsonb, jsonb) from anon, authenticated, public;

-- ===== LOGIN: verifies password, issues a session token (returned in the "password" column slot) =====
create or replace function public.loyalty_login(p_phone text, p_password text)
returns setof customers language plpgsql security definer set search_path to 'public','pg_temp' as $$
declare v_tok uuid := gen_random_uuid();
begin
  update public.customers c
     set session_token = v_tok, session_expires = now() + interval '90 days'
   where c.phone = btrim(p_phone)
     and c.password is not null and c.password <> ''
     and case when c.password ~ '^\$2[abxy]\$'
              then c.password = extensions.crypt(p_password, c.password)
              else c.password = p_password end;
  if not found then return; end if;
  return query
    select c.phone, c.name, c.address, c.birthday, c.loyalty_points, c.tier,
           c.saved_favorites, c.order_history, v_tok::text as password,
           c.coupons, c.saved_addresses, c.pdpa_accepted, c.line_user_id,
           null::text as staff_note, c.tags, null::uuid, null::timestamptz
    from public.customers c where c.phone = btrim(p_phone);
end $$;

-- ===== LOOKUP: full profile for staff/owner, trimmed (name/points/tier/coupons) for anyone else =====
drop function if exists public.loyalty_lookup(text);
create or replace function public.loyalty_lookup(p_phone text, p_token uuid default null)
returns setof customers language sql stable security definer set search_path to 'public','pg_temp' as $$
  select c.phone, c.name,
         case when public.loyalty_role(p_phone,p_token) <> 'none' then c.address end,
         case when public.loyalty_role(p_phone,p_token) <> 'none' then c.birthday end,
         c.loyalty_points, c.tier,
         case when public.loyalty_role(p_phone,p_token) <> 'none' then c.saved_favorites else '[]'::jsonb end,
         case when public.loyalty_role(p_phone,p_token) <> 'none' then c.order_history else '[]'::jsonb end,
         null::text,
         c.coupons,
         case when public.loyalty_role(p_phone,p_token) <> 'none' then c.saved_addresses else '[]'::jsonb end,
         c.pdpa_accepted,
         case when public.loyalty_role(p_phone,p_token) = 'staff' then c.line_user_id end,
         case when public.loyalty_role(p_phone,p_token) = 'staff' then c.staff_note end,
         case when public.loyalty_role(p_phone,p_token) = 'staff' then c.tags else '[]'::jsonb end,
         null::uuid, null::timestamptz
  from public.customers c where c.phone = btrim(p_phone);
$$;

-- ===== UPDATE: field-level permissions by role =====
drop function if exists public.loyalty_update(text, jsonb);
create or replace function public.loyalty_update(p_phone text, p jsonb, p_token uuid default null)
returns void language plpgsql security definer set search_path to 'public','pg_temp' as $$
declare r text := public.loyalty_role(p_phone, p_token); c public.customers;
begin
  select * into c from public.customers where phone = btrim(p_phone);
  if not found then return; end if;
  update public.customers set
    -- points: staff any value; owner may only spend (decrease); anon never. Earning is done by the orders trigger.
    loyalty_points  = case when p ? 'loyalty_points' and (r='staff' or (r='owner' and nullif(p->>'loyalty_points','')::numeric <= c.loyalty_points))
                           then nullif(p->>'loyalty_points','')::numeric else c.loyalty_points end,
    tier            = case when p ? 'tier' and r='staff' then p->>'tier' else c.tier end,
    order_history   = case when p ? 'order_history' and r='staff' then p->'order_history' else c.order_history end,
    coupons         = case when p ? 'coupons' and (r<>'none' or public.coupons_used_only(c.coupons, p->'coupons')) then p->'coupons' else c.coupons end,
    saved_favorites = case when p ? 'saved_favorites' and r<>'none' then p->'saved_favorites' else c.saved_favorites end,
    saved_addresses = case when p ? 'saved_addresses' then p->'saved_addresses' else c.saved_addresses end,
    line_user_id    = case when p ? 'line_user_id' and r='staff' then nullif(p->>'line_user_id','') else c.line_user_id end
  where phone = btrim(p_phone);
end $$;

-- ===== UPSERT: register new account (returns session token) / update own profile with token =====
drop function if exists public.loyalty_upsert(jsonb);
create or replace function public.loyalty_upsert(p jsonb, p_token uuid default null)
returns text language plpgsql security definer set search_path to 'public','pg_temp' as $$
declare
  v_phone text := btrim(p->>'phone');
  v_pass text := p->>'password';
  v_has_pass boolean;
  v_tok uuid;
  r text;
  c public.customers;
begin
  if coalesce(v_phone,'') = '' then raise exception 'phone is required'; end if;
  v_has_pass := v_pass is not null and btrim(v_pass) <> '';
  if v_has_pass and v_pass !~ '^\$2[abxy]\$' then
    v_pass := extensions.crypt(v_pass, extensions.gen_salt('bf'));
  end if;

  select * into c from public.customers where phone = v_phone;

  if not found then
    -- NEW ACCOUNT: everyone starts at 0 points / Bronze / empty history
    v_tok := gen_random_uuid();
    insert into public.customers (phone, name, address, birthday, password, loyalty_points, tier,
        saved_favorites, order_history, coupons, saved_addresses, pdpa_accepted, session_token, session_expires)
    values (v_phone, p->>'name', p->>'address', p->>'birthday',
        case when v_has_pass then v_pass end, 0, 'Bronze',
        coalesce(p->'saved_favorites','[]'::jsonb), '[]'::jsonb,
        coalesce(p->'coupons','[]'::jsonb), coalesce(p->'saved_addresses','[]'::jsonb),
        (p->>'pdpa_accepted')::boolean, v_tok, now() + interval '90 days');
    return v_tok::text;
  end if;

  r := public.loyalty_role(v_phone, p_token);
  if r = 'none' then raise exception 'LOGIN_REQUIRED'; end if;

  update public.customers set
    name            = case when p ? 'name'            then p->>'name'            else c.name end,
    address         = case when p ? 'address'         then p->>'address'         else c.address end,
    birthday        = case when p ? 'birthday'        then p->>'birthday'        else c.birthday end,
    password        = case when v_has_pass and (r='staff' or (p ? 'new_password')) then v_pass else c.password end,
    loyalty_points  = case when p ? 'loyalty_points' and (r='staff' or nullif(p->>'loyalty_points','')::numeric <= c.loyalty_points)
                           then nullif(p->>'loyalty_points','')::numeric else c.loyalty_points end,
    tier            = case when p ? 'tier' and r='staff' then p->>'tier' else c.tier end,
    order_history   = case when p ? 'order_history' and r='staff' then p->'order_history' else c.order_history end,
    saved_favorites = case when p ? 'saved_favorites' then p->'saved_favorites' else c.saved_favorites end,
    coupons         = case when p ? 'coupons'         then p->'coupons'         else c.coupons end,
    saved_addresses = case when p ? 'saved_addresses' then p->'saved_addresses' else c.saved_addresses end,
    pdpa_accepted   = case when p ? 'pdpa_accepted'   then (p->>'pdpa_accepted')::boolean else c.pdpa_accepted end
  where phone = v_phone;
  return coalesce(p_token::text, '');
end $$;

-- ===== POINTS EARNED BY THE DATABASE (1 point per pizza/promotion item), not by the browser =====
create or replace function public.order_pizza_count(p_items jsonb)
returns numeric language sql stable set search_path to 'public','pg_temp' as $$
  select coalesce(sum(coalesce((i.v->>'quantity')::numeric,1)),0)
  from jsonb_array_elements(coalesce(p_items,'[]'::jsonb)) i(v)
  join public.menu_items m on m.id = i.v->>'pizzaId'
  where m.category in ('pizza','promotion');
$$;

create or replace function public.orders_loyalty_trigger()
returns trigger language plpgsql security definer set search_path to 'public','pg_temp' as $$
declare v_delta numeric; v_phone text := btrim(coalesce(new.customer_phone,''));
begin
  if v_phone = '' then return new; end if;
  if tg_op = 'INSERT' then
    v_delta := public.order_pizza_count(new.items);
    update public.customers set
      loyalty_points  = coalesce(loyalty_points,0) + v_delta,
      order_history   = case when coalesce(order_history,'[]'::jsonb) ? new.id then order_history
                             else jsonb_build_array(new.id) || coalesce(order_history,'[]'::jsonb) end,
      saved_addresses = case when new.type = 'delivery' and coalesce(new.delivery_address,'') <> ''
                              and not coalesce(saved_addresses,'[]'::jsonb) ? new.delivery_address
                             then (select jsonb_agg(x) from (select x from jsonb_array_elements(jsonb_build_array(new.delivery_address) || coalesce(saved_addresses,'[]'::jsonb)) x limit 5) s)
                             else saved_addresses end
    where phone = v_phone;
  elsif tg_op = 'UPDATE' and new.items is distinct from old.items then
    v_delta := public.order_pizza_count(new.items) - public.order_pizza_count(old.items);
    if v_delta <> 0 then
      update public.customers set loyalty_points = greatest(0, coalesce(loyalty_points,0) + v_delta) where phone = v_phone;
    end if;
  end if;
  return new;
end $$;
drop trigger if exists trg_orders_loyalty on public.orders;
create trigger trg_orders_loyalty after insert or update of items on public.orders
  for each row execute function public.orders_loyalty_trigger();

-- ===== ORDER EDIT BY CUSTOMER: must know the phone on the order (rating/comment still allowed by id) =====
drop function if exists public.customer_update_order(text, jsonb);
create or replace function public.customer_update_order(p_id text, p jsonb, p_phone text default null)
returns void language plpgsql security definer set search_path to 'public','pg_temp' as $$
declare o public.orders;
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
    if auth.uid() is null and (p_phone is null or btrim(p_phone) = '' or btrim(p_phone) <> btrim(coalesce(o.customer_phone,''))) then
      raise exception 'PHONE_MISMATCH';
    end if;
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

-- ===== TRACK: by id only recent orders with masked contact; full row when phone matches or staff =====
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
         o.delivery_vehicle, o.scheduled_at, null::numeric, null::jsonb, o.stock_deducted
  from public.orders o
  where (o.id = any(coalesce(p_ids, array[]::text[])) and (auth.uid() is not null or o.created_at > now() - interval '3 days'))
     or (p_phone is not null and btrim(p_phone) <> '' and o.customer_phone = btrim(p_phone)
         and o.created_at > now() - interval '2 days')
  order by o.created_at desc
  limit 50;
$$;

-- ===== WEBHOOK: only the server (service role) may call it =====
revoke execute on function public.webhook_update_delivery_status(text, text) from anon, authenticated, public;

-- grants for the new signatures
grant execute on function public.loyalty_login(text,text), public.loyalty_lookup(text,uuid),
  public.loyalty_update(text,jsonb,uuid), public.loyalty_upsert(jsonb,uuid),
  public.customer_update_order(text,jsonb,text), public.track_orders(text[],text) to anon, authenticated;
revoke execute on function public.order_pizza_count(jsonb), public.orders_loyalty_trigger() from anon, authenticated, public;
