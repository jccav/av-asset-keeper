
CREATE POLICY "Admins can delete checkout logs"
ON public.checkout_log
FOR DELETE
USING (is_admin(auth.uid()));
