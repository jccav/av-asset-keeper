
-- Allow anyone to update equipment (needed for public checkout/return flow)
CREATE POLICY "Anyone can update equipment availability"
ON public.equipment
FOR UPDATE
USING (true);
