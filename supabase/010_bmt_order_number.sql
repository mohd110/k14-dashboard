-- ============================================================
-- 010 — New BMT order-number format, null-store safe
--       (mirror of customer app migration 013)
--
-- Was:  <PREFIX>/LKO/<DDMMYYYY>/OR-<seq>   e.g. KABACCHI/LKO/07072026/OR-1
-- Now:  BMT/<STORE3>/<DDMMYY>-<0001>       e.g. BMT/KEB/020726-0001
--
-- The dashboard and customer app share one Supabase project, so run this
-- ONCE (either this file or the customer app's 013). STORE3 = first 3
-- alphanumerics of the store NAME (Kebabchi → KEB, K14 Bakery → K14), or
-- BMT for a store-less order. Fixes the "null value in column store_id of
-- relation order_counters" crash via an all-zeros sentinel + FK drop.
-- Idempotent.
-- ============================================================

DO $$
DECLARE r record;
BEGIN
  FOR r IN
    SELECT conname FROM pg_constraint
    WHERE conrelid = 'public.order_counters'::regclass AND contype = 'f'
  LOOP
    EXECUTE format('ALTER TABLE public.order_counters DROP CONSTRAINT %I', r.conname);
  END LOOP;
END $$;

CREATE OR REPLACE FUNCTION public.assign_order_number()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  d_key    DATE;
  seq      INTEGER;
  sname    TEXT;
  code3    TEXT;
  v_store  UUID;
BEGIN
  d_key := COALESCE(
    NULLIF(NEW.delivery_address->>'date', '')::date,
    (NEW.created_at AT TIME ZONE 'Asia/Kolkata')::date,
    CURRENT_DATE
  );

  v_store := COALESCE(NEW.store_id, '00000000-0000-0000-0000-000000000000'::uuid);

  SELECT s.name INTO sname FROM public.stores s WHERE s.id = NEW.store_id;
  code3 := UPPER(SUBSTRING(
    regexp_replace(COALESCE(sname, 'BMT'), '[^A-Za-z0-9]', '', 'g') FROM 1 FOR 3
  ));
  code3 := COALESCE(NULLIF(code3, ''), 'BMT');

  INSERT INTO public.order_counters (store_id, date_key, last_seq)
  VALUES (v_store, d_key, 1)
  ON CONFLICT (store_id, date_key)
    DO UPDATE SET last_seq = public.order_counters.last_seq + 1
  RETURNING last_seq INTO seq;

  NEW.order_seq  := seq;
  NEW.order_code := 'BMT/' || code3 || '/' || to_char(d_key, 'DDMMYY')
                    || '-' || lpad(seq::text, 4, '0');
  RETURN NEW;
END;
$$;
