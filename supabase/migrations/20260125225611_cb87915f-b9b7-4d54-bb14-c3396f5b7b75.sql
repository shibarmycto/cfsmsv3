-- Create promo_orders table for YouTube video promotion purchases
CREATE TABLE public.promo_orders (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  youtube_url TEXT NOT NULL,
  video_title TEXT,
  package_type TEXT NOT NULL CHECK (package_type IN ('7_days', '30_days')),
  price_gbp NUMERIC NOT NULL,
  payment_method TEXT NOT NULL CHECK (payment_method IN ('manual', 'crypto', 'tokens')),
  crypto_type TEXT,
  tx_hash TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'paid', 'approved', 'active', 'completed', 'rejected', 'expired')),
  admin_notes TEXT,
  reviewed_by UUID,
  reviewed_at TIMESTAMP WITH TIME ZONE,
  starts_at TIMESTAMP WITH TIME ZONE,
  ends_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.promo_orders ENABLE ROW LEVEL SECURITY;

-- Users can create their own promo orders
CREATE POLICY "Users can create own promo orders"
ON public.promo_orders
FOR INSERT
WITH CHECK (auth.uid() = user_id);

-- Users can view their own promo orders
CREATE POLICY "Users can view own promo orders"
ON public.promo_orders
FOR SELECT
USING (auth.uid() = user_id);

-- Users can update their own pending orders
CREATE POLICY "Users can update own pending orders"
ON public.promo_orders
FOR UPDATE
USING (auth.uid() = user_id AND status = 'pending');

-- Admins can view all promo orders
CREATE POLICY "Admins can view all promo orders"
ON public.promo_orders
FOR SELECT
USING (has_role(auth.uid(), 'admin'::app_role));

-- Admins can update all promo orders
CREATE POLICY "Admins can update all promo orders"
ON public.promo_orders
FOR UPDATE
USING (has_role(auth.uid(), 'admin'::app_role));

-- Admins can delete promo orders
CREATE POLICY "Admins can delete promo orders"
ON public.promo_orders
FOR DELETE
USING (has_role(auth.uid(), 'admin'::app_role));

-- Create trigger for updated_at
CREATE TRIGGER update_promo_orders_updated_at
BEFORE UPDATE ON public.promo_orders
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();