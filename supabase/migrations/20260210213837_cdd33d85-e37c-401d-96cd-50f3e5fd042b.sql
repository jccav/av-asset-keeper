-- Add condition_counts JSONB column to track how many units are in each condition
ALTER TABLE public.equipment ADD COLUMN condition_counts jsonb NOT NULL DEFAULT '{}';

-- Backfill existing data: put all total_quantity into their current condition
UPDATE public.equipment SET condition_counts = jsonb_build_object(condition::text, total_quantity);