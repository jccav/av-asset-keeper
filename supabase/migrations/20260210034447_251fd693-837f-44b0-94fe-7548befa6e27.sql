
-- Add 'excellent' and 'bad' to equipment_condition enum
ALTER TYPE public.equipment_condition ADD VALUE IF NOT EXISTS 'excellent' BEFORE 'good';
ALTER TYPE public.equipment_condition ADD VALUE IF NOT EXISTS 'bad' AFTER 'damaged';

-- Add quantity_returned to checkout_log to track partial returns
ALTER TABLE public.checkout_log ADD COLUMN IF NOT EXISTS quantity_returned integer NOT NULL DEFAULT 0;
