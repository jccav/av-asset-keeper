
-- Admins need to see all equipment including retired, and UPDATE requires new row to pass SELECT
CREATE POLICY "Admins can view all equipment"
ON public.equipment
FOR SELECT
USING (is_admin(auth.uid()));
