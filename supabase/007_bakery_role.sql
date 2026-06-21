-- ============================================================
-- 007 — Bakery staff role
-- Adds a limited 'bakery' role that can manage only Orders and Menu
-- from the dashboard. It gets the same orders + menu privileges as
-- 'restaurant', but the UI hides every other section.
-- Run this in your Supabase SQL Editor (same project as the apps).
-- ============================================================

-- ── Allow the new role value on profiles ────────────────────
ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_role_check;
ALTER TABLE public.profiles
  ADD CONSTRAINT profiles_role_check
  CHECK (role IN ('customer', 'restaurant', 'bakery'));

-- Treat restaurant + bakery as "staff" everywhere below.

-- ── Orders: staff can read every order and update it ────────
DROP POLICY IF EXISTS "orders_select" ON public.orders;
CREATE POLICY "orders_select" ON public.orders FOR SELECT
  USING (
    auth.uid() = customer_id
    OR EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role IN ('restaurant', 'bakery')
    )
  );

DROP POLICY IF EXISTS "orders_update_restaurant" ON public.orders;
DROP POLICY IF EXISTS "orders_update_staff" ON public.orders;
CREATE POLICY "orders_update_staff" ON public.orders FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role IN ('restaurant', 'bakery')
    )
  );

-- ── Order items: staff can read them (order detail view) ────
DROP POLICY IF EXISTS "order_items_select" ON public.order_items;
CREATE POLICY "order_items_select" ON public.order_items FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.orders
      WHERE id = order_id AND (
        customer_id = auth.uid()
        OR EXISTS (
          SELECT 1 FROM public.profiles
          WHERE id = auth.uid() AND role IN ('restaurant', 'bakery')
        )
      )
    )
  );

-- ── Products: staff can update stock / availability flag ────
DROP POLICY IF EXISTS "products_update_restaurant" ON public.products;
DROP POLICY IF EXISTS "products_update_staff" ON public.products;
CREATE POLICY "products_update_staff" ON public.products FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role IN ('restaurant', 'bakery')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role IN ('restaurant', 'bakery')
    )
  );

-- ── Per-date availability: staff can add/remove dates ───────
DROP POLICY IF EXISTS "product_availability_write_restaurant" ON public.product_availability;
DROP POLICY IF EXISTS "product_availability_write_staff" ON public.product_availability;
CREATE POLICY "product_availability_write_staff"
  ON public.product_availability FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role IN ('restaurant', 'bakery')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role IN ('restaurant', 'bakery')
    )
  );

-- ── Promote a bakery account ────────────────────────────────
-- Create the auth user first (Dashboard → Authentication → Users),
-- e.g. bakery@k14.com, then run this so it becomes a 'bakery' profile.
INSERT INTO public.profiles (id, role, full_name, email)
SELECT id, 'bakery', COALESCE(raw_user_meta_data->>'full_name', 'K14 Bakery'), email
FROM auth.users
WHERE email = 'bakery@k14.com'
ON CONFLICT (id) DO UPDATE SET role = 'bakery';
