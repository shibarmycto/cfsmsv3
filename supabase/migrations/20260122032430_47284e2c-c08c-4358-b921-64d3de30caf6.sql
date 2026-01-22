-- Create crypto_orders table
CREATE TABLE public.crypto_orders (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  credits_amount INTEGER NOT NULL,
  price_usd NUMERIC NOT NULL,
  crypto_type TEXT NOT NULL,
  wallet_address TEXT NOT NULL,
  expected_amount NUMERIC NOT NULL,
  tx_hash TEXT,
  status TEXT NOT NULL DEFAULT 'pending',
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
  paid_at TIMESTAMP WITH TIME ZONE,
  admin_notes TEXT,
  reviewed_by UUID,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.crypto_orders ENABLE ROW LEVEL SECURITY;

-- Users can create their own orders
CREATE POLICY "Users can create own crypto orders"
ON public.crypto_orders
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);

-- Users can view their own orders
CREATE POLICY "Users can view own crypto orders"
ON public.crypto_orders
FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

-- Users can update their own pending orders (to add tx_hash)
CREATE POLICY "Users can update own pending orders"
ON public.crypto_orders
FOR UPDATE
TO authenticated
USING (auth.uid() = user_id AND status = 'pending');

-- Admins can view all orders
CREATE POLICY "Admins can view all crypto orders"
ON public.crypto_orders
FOR SELECT
TO authenticated
USING (has_role(auth.uid(), 'admin'));

-- Admins can update orders
CREATE POLICY "Admins can update crypto orders"
ON public.crypto_orders
FOR UPDATE
TO authenticated
USING (has_role(auth.uid(), 'admin'));