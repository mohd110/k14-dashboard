-- ============================================================
-- 011 — Explicit 'super_admin' role
--
-- Until now the marketplace super-admin was inferred: a staff account
-- (restaurant/bakery) whose profiles.store_id was NULL. Nulling `role`
-- itself violates profiles_role_check, so we add a first-class
-- 'super_admin' role value instead.
--
--   role = 'super_admin'  → sees / manages ALL stores
--   role = 'restaurant'   → store admin (scoped by store_id)
--   role = 'bakery'       → limited store staff (scoped by store_id)
--
-- Additive & idempotent — safe to run on live data.
-- Run this in your Supabase SQL Editor (same project as the apps).
-- ============================================================

-- ── 1. Allow the new role value on profiles ─────────────────
ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_role_check;
ALTER TABLE public.profiles
  ADD CONSTRAINT profiles_role_check
  CHECK (role IN ('customer', 'restaurant', 'bakery', 'super_admin'));

-- ── 2. Let super_admin pass the store-access gate ───────────
-- This helper backs every staff RLS policy (orders, order_items,
-- products, product_availability). super_admin has store_id = NULL,
-- so the existing NULL branch already grants access to every store —
-- we just have to accept the new role value here.
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
      AND p.role IN ('restaurant', 'bakery', 'super_admin')
      AND (p.store_id IS NULL OR p.store_id = target_store)
  );
$$;

-- ── 3. Promote the dashboard admin to super_admin ───────────
-- store_id must be NULL so the super-admin can act on every store.
UPDATE public.profiles
SET role = 'super_admin', store_id = NULL
WHERE email = 'admin@k14.com';
