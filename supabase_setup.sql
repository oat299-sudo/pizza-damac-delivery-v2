-- ==========================================
-- SUPABASE SCHEMA SETUP FOR POS v2.1
-- Run this in your Supabase SQL Editor
-- ==========================================

-- 1. Store Settings Table
CREATE TABLE IF NOT EXISTS store_settings (
    id SERIAL PRIMARY KEY,
    is_open BOOLEAN DEFAULT true,
    closed_message TEXT,
    promo_banner_url TEXT,
    promo_content_type TEXT,
    review_links JSONB DEFAULT '[]'::jsonb,
    vibe_links JSONB DEFAULT '[]'::jsonb,
    event_gallery_urls JSONB DEFAULT '[]'::jsonb,
    holiday_start TEXT,
    holiday_end TEXT,
    review_url TEXT,
    facebook_url TEXT,
    line_url TEXT,
    map_url TEXT,
    contact_phone TEXT,
    prompt_pay_number TEXT,
    news_items JSONB DEFAULT '[]'::jsonb,
    partners JSONB DEFAULT '[]'::jsonb
);

-- Initialize the first row for settings if it doesn't exist
INSERT INTO store_settings (id, is_open) VALUES (1, true) ON CONFLICT (id) DO NOTHING;

-- 2. Menu Items Table
CREATE TABLE IF NOT EXISTS menu_items (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    name_th TEXT,
    description TEXT,
    description_th TEXT,
    base_price NUMERIC NOT NULL,
    image TEXT,
    available BOOLEAN DEFAULT true,
    category TEXT,
    combo_count INTEGER,
    is_best_seller BOOLEAN DEFAULT false
);

-- 3. Toppings Table
CREATE TABLE IF NOT EXISTS toppings (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    name_th TEXT,
    price NUMERIC NOT NULL,
    category TEXT,
    image TEXT,
    available BOOLEAN DEFAULT true
);

-- 4. Customers Table (Loyalty Program)
CREATE TABLE IF NOT EXISTS customers (
    phone TEXT PRIMARY KEY,
    name TEXT,
    address TEXT,
    birthday TEXT,
    password TEXT,
    loyalty_points INTEGER DEFAULT 0,
    tier TEXT DEFAULT 'bronze',
    saved_favorites JSONB DEFAULT '[]'::jsonb,
    order_history JSONB DEFAULT '[]'::jsonb,
    pdpa_accepted BOOLEAN DEFAULT true,
    saved_addresses JSONB DEFAULT '[]'::jsonb,
    coupons JSONB DEFAULT '[]'::jsonb
);

-- 5. Orders Table
CREATE TABLE IF NOT EXISTS orders (
    id TEXT PRIMARY KEY,
    customer_name TEXT,
    customer_phone TEXT,
    type TEXT,
    source TEXT,
    status TEXT,
    items JSONB DEFAULT '[]'::jsonb,
    total_amount NUMERIC,
    net_amount NUMERIC,
    created_at TEXT,
    note TEXT,
    delivery_address TEXT,
    delivery_zone TEXT,
    delivery_fee NUMERIC,
    payment_method TEXT,
    pickup_time TEXT,
    table_number TEXT,
    rating INTEGER,
    comment TEXT,
    delivery_lat NUMERIC,
    delivery_lng NUMERIC,
    lalamove_status TEXT,
    lalamove_tracking_id TEXT,
    lalamove_rider_name TEXT,
    lalamove_rider_phone TEXT,
    lalamove_vehicle_type TEXT
);

-- 6. Expenses Table
CREATE TABLE IF NOT EXISTS expenses (
    id TEXT PRIMARY KEY,
    description TEXT NOT NULL,
    amount NUMERIC NOT NULL,
    category TEXT,
    date TEXT NOT NULL,
    note TEXT
);

-- 7. Promo Codes Table
CREATE TABLE IF NOT EXISTS promo_codes (
    id TEXT PRIMARY KEY,
    code TEXT NOT NULL UNIQUE,
    type TEXT NOT NULL,
    value NUMERIC NOT NULL,
    min_spend NUMERIC DEFAULT 0,
    max_discount NUMERIC,
    start_date TEXT,
    end_date TEXT,
    usage_limit INTEGER,
    usage_count INTEGER DEFAULT 0,
    is_active BOOLEAN DEFAULT true,
    applicable_categories JSONB DEFAULT '[]'::jsonb
);

-- ==========================================
-- ENABLE ROW LEVEL SECURITY (RLS) FOR ALL TABLES
-- ==========================================
ALTER TABLE store_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE menu_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE toppings ENABLE ROW LEVEL SECURITY;
ALTER TABLE customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE expenses ENABLE ROW LEVEL SECURITY;
ALTER TABLE promo_codes ENABLE ROW LEVEL SECURITY;

-- ==========================================
-- CREATE PUBLIC POLICIES FOR ALL TABLES (Prototype Mode)
-- ==========================================
-- Drop existing policies to prevent errors if they already exist
DROP POLICY IF EXISTS "Allow public all on store_settings" ON store_settings;
DROP POLICY IF EXISTS "Allow public all on menu_items" ON menu_items;
DROP POLICY IF EXISTS "Allow public all on toppings" ON toppings;
DROP POLICY IF EXISTS "Allow public all on customers" ON customers;
DROP POLICY IF EXISTS "Allow public all on orders" ON orders;
DROP POLICY IF EXISTS "Allow public all on expenses" ON expenses;
DROP POLICY IF EXISTS "Allow public all on promo_codes" ON promo_codes;

-- This allows the React app to read and write data without complex authentication setup
CREATE POLICY "Allow public all on store_settings" ON store_settings FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow public all on menu_items" ON menu_items FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow public all on toppings" ON toppings FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow public all on customers" ON customers FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow public all on orders" ON orders FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow public all on expenses" ON expenses FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow public all on promo_codes" ON promo_codes FOR ALL USING (true) WITH CHECK (true);
