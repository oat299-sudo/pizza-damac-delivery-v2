-- App v1.8.1 — add columns the POS already writes but the live DB never had.
-- Without them PostgREST rejected the whole save (unknown column), so menu / topping /
-- delivery-settings edits looked saved on screen but reverted after a refresh.
-- Additive only: no data is changed or removed. toppings.available defaults to true (all toppings stay on sale).
-- ORDER: apply AFTER app v1.8.1 is deployed (older app code read grab_price/lineman_price with
-- "!== undefined" and would show null prices once the columns exist).
alter table public.menu_items
  add column if not exists raw_cost numeric,
  add column if not exists grab_price numeric,
  add column if not exists lineman_price numeric;

alter table public.toppings
  add column if not exists image text,
  add column if not exists available boolean not null default true;

alter table public.store_settings
  add column if not exists store_location_gps text,
  add column if not exists free_delivery_radius_km numeric,
  add column if not exists delivery_fee_per_km numeric,
  add column if not exists base_delivery_fee numeric;

alter table public.expenses
  add column if not exists quantity numeric,
  add column if not exists unit text,
  add column if not exists unit_price numeric,
  add column if not exists vendor text,
  add column if not exists bill_number text;
