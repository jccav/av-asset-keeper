
DROP POLICY "Anyone can update checkout" ON public.checkout_log;

CREATE POLICY "Anyone can update checkout"
ON public.checkout_log
FOR UPDATE
USING (true);
