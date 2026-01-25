-- Add view_count column to promo_orders table for tracking video views
ALTER TABLE public.promo_orders 
ADD COLUMN IF NOT EXISTS view_count integer NOT NULL DEFAULT 0;

-- Create an index for efficient querying of active promos by views
CREATE INDEX IF NOT EXISTS idx_promo_orders_view_count ON public.promo_orders(view_count DESC) WHERE status = 'active';