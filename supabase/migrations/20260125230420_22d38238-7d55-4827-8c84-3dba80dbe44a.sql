-- Allow all authenticated users to read active promo orders (for the miner playlist)
CREATE POLICY "Anyone can view active promo orders" 
ON public.promo_orders 
FOR SELECT 
USING (status = 'active' AND starts_at <= now() AND ends_at >= now());