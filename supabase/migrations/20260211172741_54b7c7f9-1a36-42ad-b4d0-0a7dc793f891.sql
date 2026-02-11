
-- Remove overly permissive public write policies on checkout_log
DROP POLICY IF EXISTS "Anyone can create checkout" ON public.checkout_log;
DROP POLICY IF EXISTS "Anyone can update checkout" ON public.checkout_log;

-- Remove overly permissive equipment update policy
DROP POLICY IF EXISTS "Anyone can update equipment availability" ON public.equipment;

-- Create a view that hides PINs from public checkout_log reads
CREATE OR REPLACE VIEW public.checkout_log_public
WITH (security_invoker = on) AS
SELECT id, equipment_id, checkout_date, expected_return, borrower_name, team_name,
       notes, quantity, quantity_returned, return_date, condition_on_return,
       return_notes, returned_by, checkout_condition_counts, created_at
FROM public.checkout_log;
-- PIN column is intentionally excluded

-- Keep the public SELECT policy but it no longer exposes PINs since
-- the frontend will use the view. Admins still get full access via the base table.
-- Actually, let's restrict the base table SELECT to admins only
DROP POLICY IF EXISTS "Anyone can view checkout logs" ON public.checkout_log;

CREATE POLICY "Admins can view all checkout logs"
ON public.checkout_log
FOR SELECT
USING (is_admin(auth.uid()));

-- Grant SELECT on the view to anon and authenticated
GRANT SELECT ON public.checkout_log_public TO anon, authenticated;
