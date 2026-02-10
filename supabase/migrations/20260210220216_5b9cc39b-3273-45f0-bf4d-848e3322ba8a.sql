-- Store condition breakdown at checkout time so returns can default to it
ALTER TABLE public.checkout_log ADD COLUMN IF NOT EXISTS checkout_condition_counts jsonb DEFAULT '{}'::jsonb;

-- Separate return notes from checkout notes (existing 'notes' column = checkout notes)
ALTER TABLE public.checkout_log ADD COLUMN IF NOT EXISTS return_notes text;