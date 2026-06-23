-- ============================================================
-- 008 — Calendar / KOT support
-- The Calendar page's "Reject" button sets orders.status = 'rejected'.
-- This widens the status CHECK constraint to allow that value while
-- keeping every existing workflow status valid.
-- Run this in your Supabase SQL Editor (same project as the apps).
-- ============================================================

ALTER TABLE public.orders DROP CONSTRAINT IF EXISTS orders_status_check;
ALTER TABLE public.orders
  ADD CONSTRAINT orders_status_check
  CHECK (status IN ('pending', 'accepted', 'preparing', 'ready', 'rejected'));
