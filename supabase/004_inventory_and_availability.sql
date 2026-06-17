-- ============================================================
-- 004 — Inventory (stock) + per-date availability management
-- Same Supabase project as the customer app.
-- Requires migration 003 (product_availability) to have run first.
-- Run this in your Supabase SQL Editor.
-- ============================================================

-- ── Stock column ────────────────────────────────────────────
-- Whole-unit inventory count. Reduced automatically as orders come in.
ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS stock INTEGER NOT NULL DEFAULT 0;

-- ── Auto-reduce stock when an order is placed ───────────────
-- Fires for every order_items row inserted (by the customer app at
-- checkout). SECURITY DEFINER so it runs regardless of the buyer's RLS.
CREATE OR REPLACE FUNCTION public.reduce_stock_on_order_item()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.product_id IS NOT NULL THEN
    UPDATE public.products
    SET stock = GREATEST(0, stock - NEW.quantity)
    WHERE id = NEW.product_id;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_reduce_stock ON public.order_items;
CREATE TRIGGER trg_reduce_stock
  AFTER INSERT ON public.order_items
  FOR EACH ROW EXECUTE FUNCTION public.reduce_stock_on_order_item();

-- ── Let restaurant accounts update products (stock / availability) ──
-- 001 only granted SELECT on products; the dashboard needs UPDATE.
DROP POLICY IF EXISTS "products_update_restaurant" ON public.products;
CREATE POLICY "products_update_restaurant"
  ON public.products FOR UPDATE
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
