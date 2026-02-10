
-- Add quantity fields to equipment
ALTER TABLE public.equipment ADD COLUMN total_quantity integer NOT NULL DEFAULT 1;
ALTER TABLE public.equipment ADD COLUMN quantity_available integer NOT NULL DEFAULT 1;

-- Add quantity to checkout_log
ALTER TABLE public.checkout_log ADD COLUMN quantity integer NOT NULL DEFAULT 1;

-- Sync existing data: if is_available=false, set quantity_available=0
UPDATE public.equipment SET quantity_available = 0 WHERE is_available = false;
