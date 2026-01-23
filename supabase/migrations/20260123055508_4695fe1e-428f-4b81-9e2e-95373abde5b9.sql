-- Allow admins to delete crypto orders
CREATE POLICY "Admins can delete crypto orders"
ON public.crypto_orders
FOR DELETE
USING (has_role(auth.uid(), 'admin'::app_role));