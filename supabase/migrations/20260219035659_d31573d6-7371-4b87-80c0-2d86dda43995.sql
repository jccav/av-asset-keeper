
-- Add new columns to checkout_log
ALTER TABLE public.checkout_log ADD COLUMN contact_number text;
ALTER TABLE public.checkout_log ADD COLUMN location_used text;
ALTER TABLE public.checkout_log ADD COLUMN av_member text;
