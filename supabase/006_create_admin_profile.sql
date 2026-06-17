-- ============================================================
-- 006 — Create the admin profile (restaurant role)
-- The dashboard signs in as admin@k14.com but has no profiles row,
-- so the restaurant-only write policies block all menu edits.
-- This creates the profile (or fixes its role if it already exists).
-- Run this in your Supabase SQL Editor.
-- ============================================================

INSERT INTO public.profiles (id, role, full_name, email)
SELECT id, 'restaurant', 'K14 Admin', email
FROM auth.users
WHERE email = 'admin@k14.com'
ON CONFLICT (id) DO UPDATE SET role = 'restaurant';

-- Verify (optional): should return one row with role = 'restaurant'
-- SELECT id, email, role FROM public.profiles WHERE email = 'admin@k14.com';
