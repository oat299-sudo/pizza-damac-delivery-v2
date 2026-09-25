-- v1.5.3 — APPLIED to the live database on 2026-09-25 (migration v1_5_3_track_orders_service_role).
-- /api/line/notify (kitchen "cooking"/"ready" LINE messages) reads the order via track_orders with the
-- SERVICE ROLE key. Since v1.5.0 the phone came back masked (081xxxxx78), so the customer's LINE was
-- never found and those messages were not sent. The server's service role now sees the full row, like staff.
create or replace function public.track_orders(p_ids text[], p_phone text default null)
returns setof orders language sql stable security definer set search_path to 'public','pg_temp' as $$
  with me as (select (auth.uid() is not null or coalesce(auth.jwt()->>'role','') = 'service_role') as staff)
  select o.id, o.customer_name,
         case when me.staff or (p_phone is not null and btrim(p_phone)=o.customer_phone) then o.customer_phone
              else regexp_replace(coalesce(o.customer_phone,''), '^(\d{3})\d+(\d{2})$', '\1xxxxx\2') end,
         o.type, o.source, o.status, o.total_amount, o.net_amount, o.created_at, o.note,
         case when me.staff or (p_phone is not null and btrim(p_phone)=o.customer_phone) then o.delivery_address
              else left(coalesce(o.delivery_address,''), 25) || case when length(coalesce(o.delivery_address,''))>25 then '…' else '' end end,
         o.delivery_zone, o.delivery_fee, o.payment_method, o.pickup_time, o.table_number, o.items,
         o.dropoff_lat, o.dropoff_lng, o.delivery_lat, o.delivery_lng, o.delivery_type, o.delivery_status,
         o.lalamove_quotation_id, o.lalamove_order_id, o.lalamove_share_link, o.rating, o.comment,
         o.delivery_vehicle, o.scheduled_at, null::numeric, null::jsonb, o.stock_deducted,
         null::text
  from public.orders o, me
  where (o.id = any(coalesce(p_ids, array[]::text[])) and (me.staff or o.created_at > now() - interval '3 days'))
     or (p_phone is not null and btrim(p_phone) <> '' and o.customer_phone = btrim(p_phone)
         and o.created_at > now() - interval '2 days')
  order by o.created_at desc
  limit 50;
$$;
