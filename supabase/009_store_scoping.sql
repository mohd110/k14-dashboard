-- ============================================================
-- 011 — Store-scoped dashboard (multi-tenant staff logins)
--
-- BookMyTabarruk is a multi-vendor marketplace (see 009_stores.sql).
-- Until now every staff account could read/write EVERY store's orders,
-- menu, and hear every store's new-order alarm. This migration makes
-- the dashboard tenant-aware:
--
--   profiles.store_id IS NULL  → super-admin: sees ALL stores
--   profiles.store_id = <uuid> → scoped to exactly one store
--
-- Roles stay 'restaurant' / 'bakery'; store_id is the tenant key.
-- Additive & idempotent — safe to run on live data.
-- Run this in your Supabase SQL Editor (same project as the apps).
-- ============================================================

-- ── 1. Tenant key on profiles ───────────────────────────────
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS store_id UUID REFERENCES public.stores(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_profiles_store ON public.profiles(store_id);

-- Optional per-store contact / payout fields (harmless if unused).
ALTER TABLE public.stores
  ADD COLUMN IF NOT EXISTS owner_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS phone    TEXT,
  ADD COLUMN IF NOT EXISTS upi_id   TEXT;

-- ── 2. Helper: is the caller staff who may touch this store? ─
-- NULL store_id on the profile = super-admin (any store passes).
CREATE OR REPLACE FUNCTION public.staff_can_access_store(target_store UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.id = auth.uid()
      AND p.role IN ('restaurant', 'bakery')
      AND (p.store_id IS NULL OR p.store_id = target_store)
  );
$$;

-- ── 3. Store-scoped RLS ─────────────────────────────────────
-- Only the STAFF branch of each policy changes; customer access
-- (own orders, public product read) is preserved.

-- orders: customer sees own; staff see only their store's orders
DROP POLICY IF EXISTS "orders_select" ON public.orders;
CREATE POLICY "orders_select" ON public.orders FOR SELECT
  USING (
    auth.uid() = customer_id
    OR public.staff_can_access_store(store_id)
  );

DROP POLICY IF EXISTS "orders_update_restaurant" ON public.orders;
DROP POLICY IF EXISTS "orders_update_staff" ON public.orders;
CREATE POLICY "orders_update_staff" ON public.orders FOR UPDATE
  USING (public.staff_can_access_store(store_id));

-- order_items: scoped through the parent order's store
DROP POLICY IF EXISTS "order_items_select" ON public.order_items;
CREATE POLICY "order_items_select" ON public.order_items FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.orders o
      WHERE o.id = order_id AND (
        o.customer_id = auth.uid()
        OR public.staff_can_access_store(o.store_id)
      )
    )
  );

-- products: public still reads all (customer menu). Staff write only own store.
DROP POLICY IF EXISTS "products_update_restaurant" ON public.products;
DROP POLICY IF EXISTS "products_update_staff" ON public.products;
CREATE POLICY "products_update_staff" ON public.products FOR UPDATE
  USING (public.staff_can_access_store(store_id))
  WITH CHECK (public.staff_can_access_store(store_id));

-- Let staff INSERT products for their own store (dashboard "add item").
DROP POLICY IF EXISTS "products_insert_staff" ON public.products;
CREATE POLICY "products_insert_staff" ON public.products FOR INSERT
  WITH CHECK (public.staff_can_access_store(store_id));

-- product_availability: scoped through the product's store
DROP POLICY IF EXISTS "product_availability_write_restaurant" ON public.product_availability;
DROP POLICY IF EXISTS "product_availability_write_staff" ON public.product_availability;
CREATE POLICY "product_availability_write_staff"
  ON public.product_availability FOR ALL
  USING (
    public.staff_can_access_store(
      (SELECT store_id FROM public.products WHERE id = product_id)
    )
  )
  WITH CHECK (
    public.staff_can_access_store(
      (SELECT store_id FROM public.products WHERE id = product_id)
    )
  );

-- ── 4. Per-store order counters + codes ─────────────────────
-- order_counters was keyed by date only, so two stores placing an
-- order on the same day collided on the same serial. Make it per-store.

-- Backfill existing counters/orders to K14 Bakery (the only store so far).
DO $$
DECLARE k14 UUID;
BEGIN
  SELECT id INTO k14 FROM public.stores WHERE slug = 'k14-bakery' LIMIT 1;
  IF k14 IS NOT NULL THEN
    ALTER TABLE public.order_counters
      ADD COLUMN IF NOT EXISTS store_id UUID REFERENCES public.stores(id) ON DELETE CASCADE;
    UPDATE public.order_counters SET store_id = k14 WHERE store_id IS NULL;
  END IF;
END $$;

-- Swap the primary key to (store_id, date_key).
ALTER TABLE public.order_counters DROP CONSTRAINT IF EXISTS order_counters_pkey;
ALTER TABLE public.order_counters
  ADD CONSTRAINT order_counters_pkey PRIMARY KEY (store_id, date_key);

-- Store-aware serial + code assignment. Code keeps the familiar
-- <PREFIX>/LKO/<DDMMYYYY>/OR-<serial> shape, prefix derived from the
-- store slug (k14-bakery → K14, kabacchi → KABACCHI), serial resets
-- per store per delivery date.
CREATE OR REPLACE FUNCTION public.assign_order_number()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  d_key  DATE;
  seq    INTEGER;
  prefix TEXT;
BEGIN
  d_key := COALESCE(
    NULLIF(NEW.delivery_address->>'date', '')::date,
    (NEW.created_at AT TIME ZONE 'Asia/Kolkata')::date,
    CURRENT_DATE
  );

  SELECT UPPER(split_part(s.slug, '-', 1)) INTO prefix
  FROM public.stores s WHERE s.id = NEW.store_id;
  prefix := COALESCE(prefix, 'K14');

  INSERT INTO public.order_counters (store_id, date_key, last_seq)
  VALUES (NEW.store_id, d_key, 1)
  ON CONFLICT (store_id, date_key)
    DO UPDATE SET last_seq = public.order_counters.last_seq + 1
  RETURNING last_seq INTO seq;

  NEW.order_seq  := seq;
  NEW.order_code := prefix || '/LKO/' || to_char(d_key, 'DDMMYYYY') || '/OR-' || seq;
  RETURN NEW;
END;
$$;

-- ── 5. Assign the existing dashboard account to its store ────
-- admin@k14.com manages K14 Bakery. To make it the ALL-stores super
-- admin instead, set store_id = NULL below.
UPDATE public.profiles p
SET store_id = (SELECT id FROM public.stores WHERE slug = 'k14-bakery' LIMIT 1)
WHERE p.email = 'admin@k14.com';

-- ── Template: add a store-scoped account (e.g. Kabacchi) ─────
-- 1) Create the auth user first (Authentication → Users → Add user),
--    e.g. kabacchi@bmt.com, then run:
--
-- INSERT INTO public.profiles (id, role, full_name, email, store_id)
-- SELECT u.id, 'restaurant', 'Kabacchi Admin', u.email,
--        (SELECT id FROM public.stores WHERE slug = 'kabacchi' LIMIT 1)
-- FROM auth.users u WHERE u.email = 'kabacchi@bmt.com'
-- ON CONFLICT (id) DO UPDATE
--   SET role = 'restaurant',
--       store_id = (SELECT id FROM public.stores WHERE slug = 'kabacchi' LIMIT 1);
