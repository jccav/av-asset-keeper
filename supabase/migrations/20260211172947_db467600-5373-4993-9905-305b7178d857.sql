
-- Enable RLS on the checkout_log_public view (it's a view, so we need to ensure security_invoker handles it)
-- The view uses security_invoker=on, so it inherits the caller's permissions.
-- Since checkout_log base table now only allows admin SELECT, public users can't read the view.
-- We need to allow anon/authenticated to SELECT from checkout_log base table but only non-sensitive columns.
-- Better approach: drop the view, recreate without security_invoker, and grant direct access.

DROP VIEW IF EXISTS public.checkout_log_public;

-- Create a security definer function to get public checkout info (no PIN)
CREATE OR REPLACE FUNCTION public.get_active_checkouts(p_equipment_id uuid)
RETURNS TABLE (
  borrower_name text,
  team_name text,
  quantity integer,
  quantity_returned integer,
  checkout_condition_counts jsonb,
  checkout_date timestamptz
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT borrower_name, team_name, quantity, quantity_returned, checkout_condition_counts, checkout_date
  FROM public.checkout_log
  WHERE equipment_id = p_equipment_id
    AND return_date IS NULL
  ORDER BY checkout_date DESC;
$$;
