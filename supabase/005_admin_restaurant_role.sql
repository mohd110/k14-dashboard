-- ============================================================
-- 005 — Fix menu edits not persisting from the dashboard
--
-- Symptom: toggling a date off (a DELETE on product_availability)
-- appears to work but reverts on reload, and the customer app still
-- shows the item. Cause: product_availability has RLS enabled with
-- only a public *read* policy — its write policy was never applied
-- (the table pre-dated migration 003). Under RLS a DELETE that
-- matches no writable rows returns success with 0 rows and no error,
-- so it silently no-ops.
--
-- This (re)creates the write policy, and also makes sure the @k14.com
-- dashboard account is a 'restaurant' profile (required by the policy).
-- Run this in your Supabase SQL Editor.
-- ============================================================

-- ── Restaurant accounts can manage availability ─────────────
ALTER TABLE public.product_availability ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "product_availability_write_restaurant" ON public.product_availability;
CREATE POLICY "product_availability_write_restaurant"
  ON public.product_availability FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role = 'restaurant'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role = 'restaurant'
    )
  );

-- Make sure the public read policy is present too (customer menu needs it).
DROP POLICY IF EXISTS "product_availability_select_all" ON public.product_availability;
CREATE POLICY "product_availability_select_all"
  ON public.product_availability FOR SELECT USING (true);

-- ── Ensure the dashboard account satisfies the policy ───────
-- Every @k14.com auth user becomes a restaurant profile (row created
-- if missing). Harmless if it's already set.
INSERT INTO public.profiles (id, role, full_name, email)
SELECT
  u.id,
  'restaurant',
  COALESCE(u.raw_user_meta_data->>'full_name', split_part(u.email, '@', 1)),
  u.email
FROM auth.users u
WHERE u.email ILIKE '%@k14.com'
ON CONFLICT (id) DO UPDATE SET role = 'restaurant';
